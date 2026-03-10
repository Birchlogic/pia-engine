#!/usr/bin/env bash
set -euo pipefail

# ─── Config ───
export AWS_PROFILE="birchlogic"
AWS="/usr/local/bin/aws"
REGION="us-east-1"
ACCOUNT_ID="506675684271"
REPO_NAME="pia-engine"
FUNCTION_NAME="pia-engine"
IMAGE_TAG="latest"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
FULL_IMAGE="${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}"
ROLE_NAME="pia-engine-lambda-role"

echo "══════════════════════════════════════════"
echo "  Deploying pia-engine to AWS Lambda"
echo "══════════════════════════════════════════"

# ─── 1. Create ECR repository (if not exists) ───
echo "→ Step 1: Ensuring ECR repository..."
$AWS ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" 2>/dev/null || \
  $AWS ecr create-repository --repository-name "$REPO_NAME" --region "$REGION" --image-scanning-configuration scanOnPush=true

# ─── 2. Login to ECR ───
echo "→ Step 2: Logging in to ECR..."
$AWS ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_URI"

# ─── 3. Build Docker image (pass env vars as build args) ───
echo "→ Step 3: Building Docker image (linux/amd64)..."

# Source .env for build args
set -a
source .env
set +a

docker build --platform linux/amd64 --provenance=false \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --build-arg S3_ENDPOINT="$S3_ENDPOINT" \
  --build-arg S3_ACCESS_KEY="$S3_ACCESS_KEY" \
  --build-arg S3_SECRET_KEY="$S3_SECRET_KEY" \
  --build-arg S3_BUCKET_NAME="$S3_BUCKET_NAME" \
  --build-arg S3_REGION="$S3_REGION" \
  --build-arg NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  --build-arg NEXTAUTH_URL="$NEXTAUTH_URL" \
  --build-arg ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -t "$REPO_NAME" .

# ─── 4. Tag and push ───
echo "→ Step 4: Tagging and pushing to ECR..."
docker tag "$REPO_NAME:latest" "$FULL_IMAGE"
docker push "$FULL_IMAGE"

# ─── 5. Create IAM role (if not exists) ───
echo "→ Step 5: Ensuring IAM role..."
ROLE_ARN=$($AWS iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)

if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
  echo "   Creating IAM role: $ROLE_NAME"
  TRUST_POLICY='{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": { "Service": "lambda.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }
    ]
  }'
  $AWS iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --region "$REGION"

  $AWS iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

  ROLE_ARN=$($AWS iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
  echo "   Waiting 10s for IAM propagation..."
  sleep 10
fi

echo "   Role ARN: $ROLE_ARN"

# ─── 6. Read env vars from .env → JSON file ───
echo "→ Step 6: Reading environment variables..."
ENV_JSON_FILE=$(mktemp)

# Build a proper JSON object using python (more reliable than bash for JSON)
python3 -c "
import json, sys
env_vars = {}
with open('.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, _, value = line.partition('=')
        value = value.strip('\"').strip(\"'\")
        env_vars[key.strip()] = value
json.dump({'Variables': env_vars}, sys.stdout)
" > "$ENV_JSON_FILE"

echo "   Loaded env vars into $ENV_JSON_FILE"

# ─── 7. Create or update Lambda function ───
echo "→ Step 7: Creating/updating Lambda function..."
LAMBDA_EXISTS=$($AWS lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null && echo "yes" || echo "no")

if [ "$LAMBDA_EXISTS" = "no" ]; then
  echo "   Creating new Lambda function..."
  $AWS lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --package-type Image \
    --code "ImageUri=$FULL_IMAGE" \
    --role "$ROLE_ARN" \
    --timeout 30 \
    --memory-size 1024 \
    --environment "file://$ENV_JSON_FILE" \
    --architectures x86_64 \
    --region "$REGION"

  echo "   Waiting for function to be active..."
  $AWS lambda wait function-active-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
else
  echo "   Updating existing Lambda function..."
  $AWS lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --image-uri "$FULL_IMAGE" \
    --region "$REGION"

  echo "   Waiting for update to complete..."
  $AWS lambda wait function-updated-v2 --function-name "$FUNCTION_NAME" --region "$REGION"

  $AWS lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout 30 \
    --memory-size 1024 \
    --environment "file://$ENV_JSON_FILE" \
    --region "$REGION"

  $AWS lambda wait function-updated-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
fi

# ─── 8. Create Function URL (if not exists) ───
echo "→ Step 8: Ensuring Function URL..."
FUNC_URL=$($AWS lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" --query 'FunctionUrl' --output text 2>/dev/null || true)

if [ -z "$FUNC_URL" ] || [ "$FUNC_URL" = "None" ]; then
  $AWS lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --region "$REGION"

  # Allow public access
  $AWS lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "FunctionURLAllowPublicAccess" \
    --action "lambda:InvokeFunctionUrl" \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" 2>/dev/null || true

  FUNC_URL=$($AWS lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" --query 'FunctionUrl' --output text)
fi

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "  🌐 Function URL: $FUNC_URL"
echo "══════════════════════════════════════════"
echo ""
echo "⚠️  Update NEXTAUTH_URL in Lambda env vars to: $FUNC_URL"

