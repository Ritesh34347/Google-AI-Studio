import { LogEntry, LogLevel } from '../types';

export const generateEnterpriseLogs = (): LogEntry[] => {
  const logs: LogEntry[] = [];
  const services = [
    'Salesforce', 'Amazon Connect', 'Kafka', 'Informatica', 
    'AWS Glue', 'Snowflake', 'SAP', 'Sales System'
  ];
  
  const now = new Date();
  
  // Helper to add log
  // minutesAgo: how many minutes in the past
  const add = (minutesAgo: number, service: string, level: LogLevel, message: string) => {
    const d = new Date(now.getTime() - minutesAgo * 60 * 1000);
    logs.push({
      id: `ent-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: d.toISOString(),
      service,
      level,
      message,
      raw: `${d.toISOString()} [${level}] ${service}: ${message}`
    });
  };

  // 1. Background noise (last 24h = 1440 mins)
  // Spread out logs for all systems to show "Monitoring" capabilities
  for (let m = 1440; m > 0; m -= 60) {
     services.forEach(s => {
        if (Math.random() > 0.7) {
            add(m, s, LogLevel.INFO, 'Health check passed. Service availability: 99.9%');
        }
     });
  }

  // 2. INCIDENT SCENARIO: "End of Quarter Data Pipeline Failure"
  // This creates a chain reaction across the ecosystem.

  // T-180 mins: Sales System pushes huge batch (Trigger)
  add(180, 'Sales System', LogLevel.INFO, 'Initiating End-of-Quarter Batch Upload (Projected: 2.5M records).');
  add(179, 'Salesforce', LogLevel.INFO, 'Bulk API Job 7502 created. Status: Uploading');

  // T-170 mins: Kafka Queue Buildup (Transport Layer stress)
  add(170, 'Kafka', LogLevel.INFO, 'Topic `sales-raw` partition 0 leader re-election initiated.');
  add(165, 'Kafka', LogLevel.WARNING, 'Consumer Group `glue-ingest-prod` lag increasing. Current lag: 50,000 msgs.');

  // T-160 mins: Glue Job Auto-Trigger (Processing Layer)
  add(160, 'AWS Glue', LogLevel.INFO, 'Job run `glue-sales-bronze` started. WorkerType: G.2X. Args: [--conf, spark.executor.memory=8g]');
  
  // T-155 mins: Amazon Connect (Correlated load - Call center receiving calls about slow system?)
  add(155, 'Amazon Connect', LogLevel.WARNING, 'High latency detected in Contact Flow `Sales_Support`. Average handle time +15%.');

  // T-150 mins: Glue Failure (Root Cause)
  add(150, 'AWS Glue', LogLevel.WARNING, 'Container memory limit exceeded. Shuffle spill to disk is critical.');
  add(149, 'AWS Glue', LogLevel.ERROR, 'Job run failed. Error: Java Heap Space / OOM. Driver unresponsive. YARN killed container.');

  // T-140 mins: Informatica Dependency Failure (Downstream 1)
  add(140, 'Informatica', LogLevel.INFO, 'Workflow `wkf_silver_enrich` triggered by schedule.');
  add(139, 'Informatica', LogLevel.ERROR, 'Dependency Error: S3 Bucket `sales-bronze-output` is empty. Manifest not found.');

  // T-130 mins: SAP Sync Failure (Downstream 2)
  add(130, 'SAP', LogLevel.ERROR, 'IDoc inbound processing failed. Mandatory field `ORDER_ID` missing from payload (Data not enriched).');
  
  // T-120 mins: Snowflake Alert (Target Layer Impact)
  add(120, 'Snowflake', LogLevel.CRITICAL, 'Pipe `SALES_PIPE` status: STALLED. File count pending: 0.');
  add(119, 'Snowflake', LogLevel.ERROR, 'Data Freshness SLA breached for table `FACT_SALES`. Last update > 4 hours.');
  add(118, 'Snowflake', LogLevel.WARNING, 'Executive Dashboard Query: "Select * from FACT_SALES" returned stale data.');

  // Recent logs
  add(10, 'Salesforce', LogLevel.INFO, 'API usage normal.');
  add(5, 'Amazon Connect', LogLevel.INFO, 'Metric data exported successfully.');

  return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};