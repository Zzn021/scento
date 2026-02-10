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
    use_lockfile   = true
  }
}

provider "aws" {
  region = var.aws_region
}