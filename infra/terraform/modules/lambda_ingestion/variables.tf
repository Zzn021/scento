variable "function_name" { type = string }
variable "zip_path"      { type = string }
variable "tags"          { type = map(string) }

variable "catalog_table_arn"  { type = string }
variable "data_bucket_arn"    { type = string }

variable "catalog_table_name" { type = string }
variable "data_bucket_name"   { type = string }