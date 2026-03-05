locals {
  name = "${var.project}-${var.env}"
}

resource "aws_dynamodb_table" "catalog" {
  name         = "${local.name}-catalog"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "fragrance_id"

  attribute {
    name = "fragrance_id"
    type = "S" 
  }

  point_in_time_recovery { enabled = true }
  tags = var.tags
}

resource "aws_dynamodb_table" "collection" {
  name         = "${local.name}-collection"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "fragrance_id"

  attribute { 
    name = "user_id"
    type = "S" 
  }

  attribute { 
    name = "fragrance_id"
    type = "S" 
  }

  point_in_time_recovery { enabled = true }
  tags = var.tags
}

resource "aws_dynamodb_table" "sotd" {
  name         = "${local.name}-sotd"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "date"

  attribute { 
    name = "user_id"
    type = "S" 
  }
  attribute { 
    name = "date"
    type = "S" 
  }

  point_in_time_recovery { enabled = true }
  tags = var.tags
}