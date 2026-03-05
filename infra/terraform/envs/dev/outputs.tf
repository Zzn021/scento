output "catalog_table_name" { value = module.dynamodb.catalog_table_name }
output "collection_table_name" { value = module.dynamodb.collection_table_name }
output "sotd_table_name" { value = module.dynamodb.sotd_table_name }

output "data_bucket_name" { value = module.s3.data_bucket_name }

output "user_pool_id" { value = module.cognito.user_pool_id }
output "user_pool_client_id" { value = module.cognito.user_pool_client_id }
output "cognito_issuer_url" { value = module.cognito.issuer_url }