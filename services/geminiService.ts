import { GoogleGenAI, Type } from "@google/genai";
import { LogEntry, LogLevel, SystemAlert } from "../types";

const MODEL_FAST = 'gemini-2.5-flash';

// Helper to always get a fresh client with the latest environment key
const getAiClient = () => {
  // process.env.API_KEY is injected by the environment after selection
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

export const parseRawLogs = async (rawText: string): Promise<LogEntry[]> => {
  const ai = getAiClient();
  const apiKey = process.env.API_KEY;
  if (!apiKey) return [];

  const prompt = `
    Analyze the following raw log lines. Parse them into a structured JSON array.
    Each object should have:
    - timestamp (ISO string if possible, or original)
    - service (name of the service or component)
    - level (INFO, WARNING, ERROR, CRITICAL, SUCCESS)
    - message (clean text description)
    
    If the level is ambiguous, infer it from the message content.
    Return ONLY the JSON array. No markdown formatting.
    
    Raw Logs:
    ${rawText.substring(0, 10000)} // Truncate to avoid token limits for this demo
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.STRING },
              service: { type: Type.STRING },
              level: { type: Type.STRING, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'SUCCESS'] },
              message: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    
    return parsed.map((p: any, idx: number) => ({
      ...p,
      id: `parsed-${Date.now()}-${idx}`,
      raw: rawText.split('\n')[idx] || ''
    }));

  } catch (error) {
    console.error("Error parsing logs with Gemini:", error);
    return [];
  }
};

export const analyzeForAlerts = async (logs: LogEntry[]): Promise<SystemAlert[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || logs.length === 0) return [];
  const ai = getAiClient();

  // Filter for errors/warnings to save tokens
  const problematicLogs = logs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL || l.level === LogLevel.WARNING);
  
  if (problematicLogs.length === 0) return [];

  const prompt = `
    Review these logs from a diverse Data Ecosystem (Snowflake, SAP, Salesforce, AWS Glue, Kafka, etc.).
    Identify correlations between failures. For example, if Glue fails and then Snowflake has missing data, group them into a single incident if possible, or link them.
    
    Create Alerts for critical issues.
    
    For each alert, include a list of 'relatedLogIds' containing the exact 'id' strings of the logs that led to this alert.
    
    Logs:
    ${JSON.stringify(problematicLogs)}

    Return a JSON array of alerts.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
              affectedService: { type: Type.STRING },
              suggestedFix: { type: Type.STRING },
              relatedLogIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);

    return parsed.map((a: any, idx: number) => ({
      ...a,
      id: `alert-${Date.now()}-${idx}`,
      status: 'active',
      timestamp: new Date().toISOString(),
      agentThoughts: []
    }));

  } catch (error) {
    console.error("Error analyzing alerts:", error);
    return [];
  }
};

export const agentDiagnoseAndHeal = async (alert: SystemAlert): Promise<{ thoughts: string, action: string, success: boolean }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { thoughts: "API Key missing.", action: "None", success: false };
  const ai = getAiClient();

  const prompt = `
    You are an Autonomous DataOps Agent managing a data platform (Snowflake, Glue, Kafka, SAP, etc.).
    Alert Triggered: "${alert.title}" in service "${alert.affectedService}".
    Description: "${alert.description}".
    
    1. Perform Root Cause Analysis. Consider upstream dependencies (e.g., Did Kafka lag cause Glue to OOM? Did Glue fail causing Snowflake staleness?).
    2. Formulate a self-healing action.
    3. Simulate execution.
    
    Return JSON:
    - thoughts: Chain-of-thought analysis of the ecosystem failure.
    - action: Specific remediation (e.g., "Scale Glue Workers", "Restart Kafka Consumer", "Trigger Backfill").
    - success: Boolean.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thoughts: { type: Type.STRING },
            action: { type: Type.STRING },
            success: { type: Type.BOOLEAN }
          }
        }
      }
    });
    
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Agent failed:", e);
    return { thoughts: "Agent process failed.", action: "Manual intervention required", success: false };
  }
};

export const streamChatResponse = async (
  history: { role: string, parts: { text: string }[] }[],
  currentMessage: string,
  context: { logs: LogEntry[], alerts: SystemAlert[] }
) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = getAiClient();

  // Important: Filter context to include ALL errors to allow correlation analysis, not just recent ones.
  const errorLogs = context.logs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL || l.level === LogLevel.WARNING);
  const recentLogs = context.logs.slice(-10); // Last 10 logs for recency

  const contextStr = `
    SYSTEM HEALTH DASHBOARD CONTEXT:
    Active Alerts: ${context.alerts.filter(a => a.status !== 'resolved').length}
    Total Logs Scanned: ${context.logs.length}
    
    ACTIVE ALERTS (Incidents):
    ${JSON.stringify(context.alerts.filter(a => a.status !== 'resolved'))}

    ALL DETECTED FAILURES & WARNINGS (Use this to find correlations):
    ${JSON.stringify(errorLogs)}
    
    RECENT SYSTEM ACTIVITY (Last 10 events):
    ${JSON.stringify(recentLogs)}
  `;

  const systemInstruction = `
    You are "DataOps - Chat", an advanced AI Site Reliability Engineer for a complex Data Ecosystem.
    The ecosystem includes Snowflake, SAP, Salesforce, Amazon Connect, Sales System, Kafka, Informatica, and AWS Glue.
    
    Your Capabilities:
    1. Answer queries about system health.
    2. EXPLAIN CORRELATIONS between failures (e.g., "Glue failed, which caused Snowflake to have stale data").
    3. Suggest fixes based on the logs.
    
    Always reference specific log entries or services when answering.
    Be professional, concise, and technical.
    
    Context:
    ${contextStr}
  `;

  const chat = ai.chats.create({
    model: MODEL_FAST,
    config: {
      systemInstruction: systemInstruction,
    },
    history: history.map(h => ({
      role: h.role,
      parts: h.parts
    }))
  });

  return chat.sendMessageStream({ message: currentMessage });
};