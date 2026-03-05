data "aws_region" "current" {}

resource "aws_iam_role" "this" {
  name = "${var.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

# Basic CloudWatch Logs permission
resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least privilege: read CSV from S3 + batch write to DynamoDB
resource "aws_iam_role_policy" "ingestion" {
  name = "${var.function_name}-policy"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${var.data_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:BatchWriteItem"]
        Resource = var.catalog_table_arn
      }
    ]
  })
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = aws_iam_role.this.arn
  runtime       = "nodejs20.x"
  handler       = "dist/index.handler"

  s3_bucket     = var.artifact_bucket
  s3_key        = var.artifact_key

  source_code_hash = var.artifact_hash

  timeout     = 900
  memory_size = 1024

  environment {
    variables = {
      CATALOG_TABLE = var.catalog_table_name
      DATA_BUCKET   = var.data_bucket_name
    }
  }

  tags = var.tags
}