import { AMFIScheme, FundMetrics } from '../types';

const BASE_URL = 'https://api.mfapi.in';
const CACHE_NAME = 'mfapi-cache-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache utility functions
const openCache = async (): Promise<Cache> => {
  return await caches.open(CACHE_NAME);
};

const getCachedResponse = async (url: string): Promise<Response | null> => {
  try {
    const cache = await openCache();
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date') || '0');
      const now = new Date();
      if (now.getTime() - cacheDate.getTime() < CACHE_DURATION) {
        return cachedResponse;
      } else {
        // Cache expired, remove it
        await cache.delete(url);
      }
    }
  } catch (error) {
    console.warn('Cache access failed:', error);
  }
  return null;
};

const setCachedResponse = async (url: string, response: Response): Promise<void> => {
  try {
    const cache = await openCache();
    const responseClone = response.clone();
    const headers = new Headers(responseClone.headers);
    headers.set('sw-cache-date', new Date().toISOString());
    const cachedResponse = new Response(responseClone.body, {
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers
    });
    await cache.put(url, cachedResponse);
  } catch (error) {
    console.warn('Cache write failed:', error);
  }
};

const fetchWithCache = async (url: string): Promise<Response> => {
  // Try to get from cache first
  const cachedResponse = await getCachedResponse(url);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fetch from network
  const response = await fetch(url);
  
  // Cache successful responses
  if (response.ok) {
    await setCachedResponse(url, response);
  }
  
  return response;
};

export const searchFunds = async (query: string): Promise<AMFIScheme[]> => {
  if (!query || query.length < 3) return [];
  try {
    const response = await fetchWithCache(`${BASE_URL}/mf/search?q=${query}`);
    const data = await response.json();
    return data.slice(0, 10); // Limit to top 10 results
  } catch (error) {
    console.error("Error searching funds:", error);
    return [];
  }
};

export const getLatestNAV = async (schemeCode: string): Promise<{ nav: number; date: string } | null> => {
  try {
    const response = await fetchWithCache(`${BASE_URL}/mf/${schemeCode}`);
    const data = await response.json();
    if (data && data.data && data.data.length > 0) {
      return {
        nav: parseFloat(data.data[0].nav),
        date: data.data[0].date
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching NAV for ${schemeCode}:`, error);
    return null;
  }
};

// Batch fetch NAVs for current holdings
export const fetchLivePrices = async (schemeCodes: string[]) => {
    const promises = schemeCodes.map(async (code) => {
        const data = await getLatestNAV(code);
        return { schemeCode: code, data };
    });
    
    const results = await Promise.all(promises);
    const priceMap: Record<string, number> = {};
    
    results.forEach(r => {
        if (r.data) {
            priceMap[r.schemeCode] = r.data.nav;
        }
    });
    
    return priceMap;
};

// Get comprehensive fund metrics (combines MFAPI with mock data for demo)
export const getFundMetrics = async (schemeCode: string): Promise<FundMetrics | null> => {
  try {
    // Try to get basic info from MFAPI
    const response = await fetchWithCache(`${BASE_URL}/mf/${schemeCode}`);
    const data = await response.json();

    if (!data || !data.meta) return null;

    const meta = data.meta;

    // Mock additional metrics for demonstration
    // In a real app, these would come from additional APIs or databases
    const mockMetrics = {
      expenseRatio: 0.5 + Math.random() * 1.5, // 0.5-2.0%
      aum: 500 + Math.random() * 2000, // 500-2500 Cr
      return1Y: 8 + Math.random() * 20, // 8-28%
      return3Y: 10 + Math.random() * 25, // 10-35%
      return5Y: 12 + Math.random() * 30, // 12-42%
      alpha: -2 + Math.random() * 4, // -2 to +2
      riskStd: 5 + Math.random() * 15, // 5-20%
      benchmarkIndex: 'Nifty 50'
    };

    // Calculate beta based on category
    let beta = 1.0;
    const category = meta.scheme_category?.toLowerCase() || '';
    if (category.includes('liquid')) beta = 0.02;
    else if (category.includes('large cap')) beta = 0.9 + Math.random() * 0.2;
    else if (category.includes('mid cap')) beta = 1.0 + Math.random() * 0.3;
    else if (category.includes('small cap')) beta = 1.1 + Math.random() * 0.4;
    else if (category.includes('sectoral')) beta = 1.2 + Math.random() * 0.3;

    return {
      schemeCode,
      expenseRatio: Math.round(mockMetrics.expenseRatio * 100) / 100,
      aum: Math.round(mockMetrics.aum),
      fundManager: meta.fund_house || 'Unknown',
      inception: meta.scheme_start_date || '2010-01-01',
      return1Y: Math.round(mockMetrics.return1Y * 100) / 100,
      return3Y: Math.round(mockMetrics.return3Y * 100) / 100,
      return5Y: Math.round(mockMetrics.return5Y * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      alpha: Math.round(mockMetrics.alpha * 100) / 100,
      riskStd: Math.round(mockMetrics.riskStd * 100) / 100,
      benchmarkIndex: mockMetrics.benchmarkIndex
    };
  } catch (error) {
    console.error(`Error fetching metrics for ${schemeCode}:`, error);
    return null;
  }
};

// Enhanced batch NAV fetching with better error handling
export const fetchLivePricesBatch = async (schemeCodes: string[], batchSize: number = 10): Promise<Record<string, number>> => {
  const priceMap: Record<string, number> = {};

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < schemeCodes.length; i += batchSize) {
    const batch = schemeCodes.slice(i, i + batchSize);
    const batchPromises = batch.map(async (code) => {
      const data = await getLatestNAV(code);
      return { schemeCode: code, data };
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(r => {
      if (r.data) {
        priceMap[r.schemeCode] = r.data.nav;
      }
    });

    // Small delay between batches to be API-friendly
    if (i + batchSize < schemeCodes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return priceMap;
};