import pyodbc

# Connect to SQL Server
conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost;DATABASE=dandytech;Trusted_Connection=yes;"

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    # Run the migration
    print("Adding purchase_price_before_tax column...")
    cursor.execute("ALTER TABLE dbo.PurchaseCalculatorItems ADD purchase_price_before_tax DECIMAL(10,2) NULL;")
    
    print("Updating existing records...")
    cursor.execute("UPDATE dbo.PurchaseCalculatorItems SET purchase_price_before_tax = calculated_purchase_price WHERE calculated_purchase_price IS NOT NULL;")
    
    conn.commit()
    print("Migration completed successfully!")
    
    # Verify the column was added
    cursor.execute("SELECT TOP 1 purchase_price_before_tax FROM dbo.PurchaseCalculatorItems WHERE purchase_price_before_tax IS NOT NULL")
    result = cursor.fetchone()
    if result:
        print(f"Verification: Found purchase_price_before_tax = {result[0]}")
    else:
        print("Verification: No data found")
        
except pyodbc.Error as e:
    if "already exists" in str(e) or "duplicate" in str(e):
        print("Column already exists, migration was already applied.")
    else:
        print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()