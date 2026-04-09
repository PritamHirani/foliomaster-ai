import { GoogleGenAI, Type } from "@google/genai";
import { Holding, AdvisorResponse } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
        throw new Error("API Key not found");
    }
    return new GoogleGenAI({ apiKey });
}

const buildLocalAdvisorResponse = (holdings: Holding[]): AdvisorResponse => {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    if (totalValue <= 0) {
        return {
            analysis: "Portfolio has no current market value yet. Add or refresh holdings to get meaningful insights.",
            riskScore: 1,
            suggestions: [
                "Add active holdings with current NAV.",
                "Track monthly SIPs for better trend analysis.",
                "Refresh prices before analyzing risk."
            ]
        };
    }

    const byCategory = holdings.reduce<Record<string, number>>((acc, h) => {
        acc[h.category] = (acc[h.category] || 0) + h.currentValue;
        return acc;
    }, {});

    const categoryShares = Object.entries(byCategory)
        .map(([category, value]) => ({ category, share: (value / totalValue) * 100 }))
        .sort((a, b) => b.share - a.share);

    const topCategory = categoryShares[0];
    const equityLikeExposure = categoryShares
        .filter(c => /small|mid|large|flexi|sectoral|equity/i.test(c.category))
        .reduce((sum, c) => sum + c.share, 0);
    const concentrated = topCategory ? topCategory.share > 40 : false;
    const highRiskHeavy = holdings.filter(h => /small|sectoral|mid/i.test(h.category)).length > Math.max(2, holdings.length / 3);

    let riskScore = 4;
    if (equityLikeExposure > 80) riskScore += 2;
    if (concentrated) riskScore += 2;
    if (highRiskHeavy) riskScore += 2;
    riskScore = Math.max(1, Math.min(10, riskScore));

    const avgReturn = holdings.reduce((sum, h) => sum + h.absoluteReturnPercentage, 0) / holdings.length;
    const positiveFunds = holdings.filter(h => h.absoluteReturnPercentage > 0).length;
    const negativeFunds = holdings.length - positiveFunds;

    const analysis = `Portfolio is spread across ${categoryShares.length} categories. ` +
        `${topCategory ? `${topCategory.category} is the largest at ${topCategory.share.toFixed(1)}%. ` : ""}` +
        `Average absolute return is ${avgReturn.toFixed(2)}%, with ${positiveFunds} funds in positive and ${negativeFunds} in negative territory.`;

    const suggestions: string[] = [];
    if (concentrated) {
        suggestions.push(`Reduce concentration in ${topCategory.category} and rebalance gradually.`);
    } else {
        suggestions.push("Maintain current diversification and rebalance quarterly.");
    }
    if (equityLikeExposure > 85) {
        suggestions.push("Add some debt or liquid allocation to reduce volatility.");
    } else {
        suggestions.push("Continue SIP discipline and increase contribution with annual step-up.");
    }
    suggestions.push("Review underperforming funds over a 3-year horizon before switching.");

    return { analysis, riskScore, suggestions };
};

export const analyzePortfolio = async (holdings: Holding[]): Promise<AdvisorResponse> => {
    try {
        const ai = getClient();
        
        const prompt = `
        Analyze this mutual fund portfolio. 
        Holdings Data: ${JSON.stringify(holdings.map(h => ({
            fund: h.fundName,
            category: h.category,
            allocation: h.currentValue,
            return: h.absoluteReturnPercentage
        })))}

        Provide:
        1. A brief analysis of diversification and performance.
        2. A risk score from 1 (Safe) to 10 (Very Risky).
        3. 3 specific actionable suggestions to improve the portfolio.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: { type: Type.STRING },
                        riskScore: { type: Type.NUMBER },
                        suggestions: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["analysis", "riskScore", "suggestions"]
                }
            }
        });

        const rawText = (response as any).text;
        const text = typeof rawText === "function" ? rawText.call(response) : rawText;
        if (!text) throw new Error("No response from AI");

        const parsed = JSON.parse(text) as Partial<AdvisorResponse>;
        if (!parsed.analysis || typeof parsed.riskScore !== "number" || !Array.isArray(parsed.suggestions)) {
            throw new Error("Invalid AI response shape");
        }
        return {
            analysis: parsed.analysis,
            riskScore: Math.max(1, Math.min(10, Math.round(parsed.riskScore))),
            suggestions: parsed.suggestions.slice(0, 3)
        };

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return buildLocalAdvisorResponse(holdings);
    }
}

export const suggestFunds = async (category: string): Promise<string[]> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Suggest 5 top performing mutual funds in India for the category: ${category}. Return only the names as a JSON string list.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        
        const rawText = (response as any).text;
        const text = typeof rawText === "function" ? rawText.call(response) : rawText;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error(e);
        return [];
    }
}
