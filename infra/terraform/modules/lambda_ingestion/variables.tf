variable "function_name" { type = string }
variable "tags"          { type = map(string) }

variable "catalog_table_arn"  { type = string }
variable "data_bucket_arn"    { type = string }

variable "catalog_table_name" { type = string }
variable "data_bucket_name"   { type = string }

variable "artifact_bucket" { type = string }
variable "artifact_key"    { type = string }
variable "artifact_hash"   { type = string } # base64sha256 of the zip