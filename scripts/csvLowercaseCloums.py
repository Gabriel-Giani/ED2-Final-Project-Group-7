import pandas as pd

# Input and output file paths
input_csv = "/Users/gabrielgiani/Downloads/OneDrive_1_2-20-2025/On2006-Trimmed.csv"   # Change this to your actual file name
output_csv = "/Users/gabrielgiani/Downloads/2006lowercase_columns.csv"

# Load the CSV file
df = pd.read_csv(input_csv, low_memory=False)

# Convert column names to lowercase
df.columns = df.columns.str.lower()

# Save the modified DataFrame to a new CSV file
df.to_csv(output_csv, index=False)

print(f"✅ Column names converted to lowercase and saved as '{output_csv}'")