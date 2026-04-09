import React, { useState } from 'react';
import { Upload, AlertCircle, Check, FileSpreadsheet, File } from 'lucide-react';
import { Transaction, TransactionType, Client, TransactionNature } from '../types';
import { saveBulkTransactions, addClient, getClients } from '../services/storageService';
import { openDbf } from 'shapefile';

interface FileImporterProps {
  onImportComplete: () => void;
  onClose: () => void;
}

const FileImporter: React.FC<FileImporterProps> = ({ onImportComplete, onClose }) => {
  const [previewData, setPreviewData] = useState<Transaction[]>([]);
  const [pendingClients, setPendingClients] = useState<Client[]>([]);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.dbf')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            await parseDBF(buffer);
            setIsProcessing(false);
        };
        reader.onerror = () => {
            setError("Failed to read file");
            setIsProcessing(false);
        }
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCSV(text);
            setIsProcessing(false);
        };
        reader.readAsText(file);
    }
  };

  // Helper to map dynamic keys
  const findValue = (record: any, keys: string[]) => {
      for (const key of keys) {
          if (record[key] !== undefined) return record[key];
          // Try case insensitive
          const recordKey = Object.keys(record).find(k => k.toLowerCase() === key.toLowerCase());
          if (recordKey) return record[recordKey];
      }
      return undefined;
  };

  const parseDBF = async (buffer: ArrayBuffer) => {
      try {
          const source = await openDbf(buffer);
          const parsed: Transaction[] = [];
          const clientsSet = new Map<string, Client>();
          const existingClients = getClients();

          let result;
          while (!(result = await source.read()).done) {
              const row = result.value;
              
              // Extract fields using common RTA headers
              const dateVal = findValue(row, ['TRXN_DATE', 'TR_DATE', 'TD_TRXN_DT', 'POST_DATE', 'DATE']);
              const arn = findValue(row, ['ARN', 'BROKER_CO', 'AGENT_CODE', 'DIST_CODE']) || 'DIRECT';
              const clientName = findValue(row, ['INV_NAME', 'INVESTOR', 'CLT_NAME', 'CLIENT_NAM']);
              const clientPan = findValue(row, ['PAN', 'PAN_NO', 'IT_PAN']);
              const schemeCode = findValue(row, ['SCHEME_CO', 'PRODCODE', 'FMCODE', 'SCHEME_COD']);
              const fundName = findValue(row, ['SCHEME_NA', 'PROD_DESC', 'SCHEME']) || 'Unknown Fund';
              const typeRaw = findValue(row, ['TRXN_TYPE', 'TRXN_NAT', 'TR_DESC', 'TYPE']);
              const amount = parseFloat(findValue(row, ['AMOUNT', 'AMT', 'GR_AMT']) || '0');
              const nav = parseFloat(findValue(row, ['NAV', 'RATE', 'PRICE', 'PUR_PRICE']) || '0');
              const units = parseFloat(findValue(row, ['UNITS', 'UNITS_', 'NO_OF_UNIT']) || '0');
              const folioNumber = findValue(row, ['FOLIO_NO', 'FOLIO', 'FOLIO_NUM']) || `DBF-${schemeCode}`;

              if (!dateVal || !clientPan) continue;

              // Format Date
              let dateStr = '';
              if (dateVal instanceof Date) {
                  dateStr = dateVal.toISOString().split('T')[0];
              } else if (typeof dateVal === 'string') {
                  // Attempt parsing common formats
                  const d = new Date(dateVal);
                  if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                  else dateStr = dateVal; // Fallback
              }

              // Determine Nature and Type
              let type = TransactionType.BUY;
              let nature = TransactionNature.LUMPSUM;
              
              const tUpper = String(typeRaw).toUpperCase();
              
              if (tUpper.includes('SIP') || tUpper.includes('SYSTEMATIC')) {
                  nature = TransactionNature.SIP;
                  type = TransactionType.BUY;
              } else if (tUpper.includes('SWP') || tUpper.includes('WITHDRAWAL')) {
                  nature = TransactionNature.SWP;
                  type = TransactionType.SELL;
              } else if (tUpper.includes('STP')) {
                   if (tUpper.includes('OUT') || amount < 0) {
                       nature = TransactionNature.STP_OUT;
                       type = TransactionType.SELL;
                   } else {
                       nature = TransactionNature.STP_IN;
                       type = TransactionType.BUY;
                   }
              } else if (tUpper.includes('SWITCH')) {
                   if (tUpper.includes('OUT') || tUpper.includes('TO') || amount < 0) {
                       nature = TransactionNature.SWITCH_OUT;
                       type = TransactionType.SELL;
                   } else {
                       nature = TransactionNature.SWITCH_IN;
                       type = TransactionType.BUY;
                   }
              } else if (tUpper.includes('RED') || tUpper.includes('SELL') || tUpper === 'R') {
                  nature = TransactionNature.LUMPSUM;
                  type = TransactionType.SELL;
              } else if (tUpper.includes('DIV')) {
                  nature = TransactionNature.DIVIDEND_REINVEST;
                  type = TransactionType.BUY; // Usually Reinvestment
              }

              // Force Sell if amount is negative (some DBFs use sign for flow)
              if (amount < 0) type = TransactionType.SELL;
              const absAmount = Math.abs(amount);
              const absUnits = Math.abs(units);

              if (absAmount === 0 || absUnits === 0) continue;

               // Find or Create Client Logic
                let clientId = existingClients.find(c => c.pan === clientPan)?.id;
                
                if (!clientId) {
                    if (clientsSet.has(clientPan)) {
                        clientId = clientsSet.get(clientPan)?.id;
                    } else {
                        clientId = crypto.randomUUID();
                        clientsSet.set(clientPan, {
                            id: clientId,
                            name: clientName || 'Unknown Client',
                            pan: clientPan,
                            associatedArn: arn
                        });
                    }
                }

              parsed.push({
                  id: crypto.randomUUID(),
                  date: dateStr,
                  schemeCode: String(schemeCode),
                  fundName,
                  type,
                  amount: absAmount,
                  nav,
                  units: absUnits,
                  category: 'Unclassified',
                  clientId: clientId!,
                  arn,
                  nature,
                  folioNumber
              });
          }

          setPreviewData(parsed);
          const newClients = Array.from(clientsSet.values());
          setPendingClients(newClients);
          setNewClientsCount(newClients.length);

      } catch (e) {
          console.error(e);
          setError("Failed to parse DBF file. Ensure it is a valid dBase format.");
          setPendingClients([]);
      }
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split('\n');
      const parsed: Transaction[] = [];
      const clientsSet = new Map<string, Client>(); 
      const existingClients = getClients();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
        
        if (cols.length < 10) continue;

        const date = cols[0]; 
        const arn = cols[1];
        const clientName = cols[2];
        const clientPan = cols[3];
        const schemeCode = cols[4];
        const fundName = cols[5];
        const typeStr = cols[6].toUpperCase();
        const amount = parseFloat(cols[7]);
        const nav = parseFloat(cols[8]);
        const units = parseFloat(cols[9]);

        if (isNaN(amount) || isNaN(nav) || isNaN(units)) continue;

        let clientId = existingClients.find(c => c.pan === clientPan)?.id;
        
        if (!clientId) {
            if (clientsSet.has(clientPan)) {
                clientId = clientsSet.get(clientPan)?.id;
            } else {
                clientId = crypto.randomUUID();
                clientsSet.set(clientPan, {
                    id: clientId,
                    name: clientName,
                    pan: clientPan,
                    associatedArn: arn
                });
            }
        }

        parsed.push({
          id: crypto.randomUUID(),
          date,
          schemeCode,
          fundName,
          type: typeStr.includes('SELL') || typeStr.includes('REDEMPTION') ? TransactionType.SELL : TransactionType.BUY,
          amount,
          nav,
          units,
          category: 'Unclassified',
          clientId: clientId!,
          arn: arn,
          nature: TransactionNature.LUMPSUM,
          folioNumber: `CSV-${schemeCode || 'NA'}`
        });
      }
      
      setPreviewData(parsed);
      const newClients = Array.from(clientsSet.values());
      setPendingClients(newClients);
      setNewClientsCount(newClients.length);
      
      setError(null);
    } catch (e) {
      setError("Failed to parse CSV. Please ensure it matches the template format.");
      setPreviewData([]);
      setPendingClients([]);
      setNewClientsCount(0);
    }
  };

  const confirmImport = () => {
    pendingClients.forEach(c => addClient(c));
    saveBulkTransactions(previewData);
    onImportComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Import Distributor Feed</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 text-sm text-blue-700">
             <p className="font-semibold mb-2 flex items-center"><AlertCircle size={16} className="mr-2"/> Instructions</p>
             <p className="mb-2">Supports <strong>.csv</strong> and <strong>.dbf</strong> (RTA Feed) formats.</p>
             <ul className="list-disc ml-5 space-y-1 text-xs opacity-80">
                 <li>CSV: <code>Date, ARN, ClientName, ClientPAN, SchemeCode, SchemeName, Type, Amount, NAV, Units</code></li>
                 <li>DBF: Standard CAMS/Karvy/Franklin format (WB/DBF)</li>
             </ul>
          </div>

          {!previewData.length && !isProcessing ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
              <input 
                type="file" 
                accept=".csv, .dbf"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-600 font-medium">Click to upload CSV or DBF</p>
              <p className="text-xs text-slate-400 mt-2">Max 10MB</p>
            </div>
          ) : isProcessing ? (
             <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                 <p>Processing File...</p>
             </div> 
          ) : (
            <div>
               <div className="flex items-center justify-between mb-4">
                   <div className="text-sm text-slate-600">
                       <span className="font-bold text-slate-800">{previewData.length}</span> transactions found.
                       {newClientsCount > 0 && <span className="ml-2 text-green-600">({newClientsCount} new clients identified)</span>}
                   </div>
                   <button onClick={() => { setPreviewData([]); setPendingClients([]); setNewClientsCount(0); }} className="text-xs text-red-500 font-medium hover:underline">Clear</button>
               </div>
               
               <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                   <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 sticky top-0">
                           <tr>
                               <th className="p-2 font-medium text-slate-500">Date</th>
                               <th className="p-2 font-medium text-slate-500">Client</th>
                               <th className="p-2 font-medium text-slate-500">Scheme</th>
                               <th className="p-2 font-medium text-slate-500">Type</th>
                               <th className="p-2 font-medium text-slate-500 text-right">Amount</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {previewData.slice(0, 50).map((t, i) => (
                               <tr key={i}>
                                   <td className="p-2 text-slate-600">{t.date}</td>
                                   <td className="p-2 text-slate-600 truncate max-w-[100px]">{t.clientId}</td>
                                   <td className="p-2 text-slate-600 truncate max-w-[150px]">{t.fundName}</td>
                                   <td className="p-2 text-slate-600">
                                       <span className={`px-1.5 py-0.5 rounded ${t.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                           {t.nature}
                                       </span>
                                   </td>
                                   <td className="p-2 text-slate-600 text-right">{t.amount.toFixed(0)}</td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                   {previewData.length > 50 && (
                       <div className="p-2 text-center text-xs text-slate-400 bg-slate-50">
                           + {previewData.length - 50} more rows
                       </div>
                   )}
               </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 text-red-600 text-sm flex items-center bg-red-50 p-3 rounded-lg animate-in slide-in-from-bottom-2">
                <AlertCircle size={16} className="mr-2" /> {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50 rounded-b-2xl">
           <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
           <button 
             onClick={confirmImport}
             disabled={previewData.length === 0}
             className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
           >
               <Check size={18} className="mr-2" /> Import Data
           </button>
        </div>
      </div>
    </div>
  );
};

export default FileImporter;
