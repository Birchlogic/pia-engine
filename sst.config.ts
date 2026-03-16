// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "pia-engine",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Nextjs("MyWeb", {
      environment: {
        DATABASE_URL: process.env.DATABASE_URL || "",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        S3_ENDPOINT: process.env.S3_ENDPOINT || "",
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "",
        S3_SECRET_KEY: process.env.S3_SECRET_KEY || "",
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || "",
        S3_REGION: process.env.S3_REGION || "",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
        SUPER_ADMIN_JWT_SECRET: process.env.SUPER_ADMIN_JWT_SECRET || "",
        PAYLOAD_TOKEN: process.env.PAYLOAD_TOKEN || "",
      }
    });
  },
});
