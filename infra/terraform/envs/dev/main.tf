terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "scento-tf-state"
    key            = "dev/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "scento-tf-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  project = var.project
  env     = var.env

  name = "${local.project}-${local.env}"

  tags = merge(var.tags, {
    Project     = local.project
    Environment = local.env
  })
}

module "dynamodb" {
  source  = "../../modules/dynamodb"
  project = local.project
  env     = local.env
  tags    = local.tags
}

module "s3" {
  source      = "../../modules/s3"
  bucket_name = "${local.name}-data-${var.name_suffix}"
  tags        = local.tags
}

module "cognito" {
  source        = "../../modules/cognito"
  project       = local.project
  env           = local.env
  tags          = local.tags
  callback_urls = var.cognito_callback_urls
  logout_urls   = var.cognito_logout_urls
  domain_prefix = "${local.name}-${var.name_suffix}"
}

data "aws_dynamodb_table" "catalog" {
  name = module.dynamodb.catalog_table_name
}

data "aws_s3_bucket" "data" {
  bucket = module.s3.data_bucket_name
}

module "ingestion_lambda" {
  source = "../../modules/lambda_ingestion"

  function_name = "${local.name}-ingestion"
  zip_path       = "${path.module}/artifacts/ingestion.zip"

  catalog_table_name = module.dynamodb.catalog_table_name
  catalog_table_arn  = data.aws_dynamodb_table.catalog.arn

  data_bucket_name = module.s3.data_bucket_name
  data_bucket_arn  = data.aws_s3_bucket.data.arn

  tags = local.tags
}

# module "iam" {
#   source = "../../modules/iam"

#   project = local.project
#   env     = local.env
#   tags    = local.tags

#   catalog_table_arn     = module.dynamodb.catalog_table_arn
#   collection_table_arn  = module.dynamodb.collection_table_arn
#   sotd_table_arn        = module.dynamodb.sotd_table_arn
#   data_bucket_arn       = module.s3.data_bucket_arn
# }

# module "lambdas" {
#   source = "../../modules/lambdas"

#   project = local.project
#   env     = local.env
#   tags    = local.tags

#   runtime = var.lambda_runtime

#   catalog_table_name     = module.dynamodb.catalog_table_name
#   collection_table_name  = module.dynamodb.collection_table_name
#   sotd_table_name        = module.dynamodb.sotd_table_name
#   data_bucket_name       = module.s3.data_bucket_name

#   collection_role_arn = module.iam.collection_role_arn
#   sotd_role_arn       = module.iam.sotd_role_arn
#   catalog_role_arn    = module.iam.catalog_role_arn
#   ingestion_role_arn  = module.iam.ingestion_role_arn

#   artifacts_dir = var.lambda_artifacts_dir
# }

# module "api" {
#   source = "../../modules/api_gateway"

#   project = local.project
#   env     = local.env
#   tags    = local.tags

#   cors_allowed_origins = var.cors_allowed_origins

#   cognito_issuer_url = module.cognito.issuer_url
#   cognito_audience   = [module.cognito.user_pool_client_id]

#   collection_invoke_arn = module.lambdas.collection_invoke_arn
#   sotd_invoke_arn       = module.lambdas.sotd_invoke_arn
#   catalog_invoke_arn    = module.lambdas.catalog_invoke_arn

#   collection_function_name = module.lambdas.collection_function_name
#   sotd_function_name       = module.lambdas.sotd_function_name
#   catalog_function_name    = module.lambdas.catalog_function_name
# }
