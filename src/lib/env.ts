const required = ["AWS_REGION"] as const;

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const warnings: string[] = [];

  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    warnings.push("AWS_ACCESS_KEY_ID not set. AWS SDK will use default credential chain (IAM role, profile, etc).");
  }

  if (!process.env.ADMIN_KEY) {
    warnings.push("ADMIN_KEY not set. Admin endpoints will be inaccessible.");
  }

  return { warnings };
}
