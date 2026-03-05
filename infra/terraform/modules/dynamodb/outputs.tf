output "catalog_table_name"    { value = aws_dynamodb_table.catalog.name }
output "collection_table_name" { value = aws_dynamodb_table.collection.name }
output "sotd_table_name"       { value = aws_dynamodb_table.sotd.name }

output "catalog_table_arn"      { value = aws_dynamodb_table.catalog.arn }
output "collection_table_arn"   { value = aws_dynamodb_table.collection.arn }
output "sotd_table_arn"         { value = aws_dynamodb_table.sotd.arn }