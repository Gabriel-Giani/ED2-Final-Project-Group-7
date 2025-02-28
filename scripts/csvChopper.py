import pandas as pd

# Input and output CSV file paths
input_csv = "input.csv"   # Change this to your actual input file
output_csv = "filtered_output.csv"

# List of columns to keep (all lowercase)
columns_to_keep = [
    "calyear", "crashnum", "casenumber", "dotcounty", "crashdate", "crashtime",
    "dayofweek", "townname", "onroadname", "inroadname", "refdirect",
    "srrouteid", "usrouteid", "roadcatgry", "highestinj", "crshalcdrg",
    "lightcond", "weathcond", "rdsurfcond", "totcrshdmg", "fl_aggrsv",
    "fl_vru_ped", "fl_vru_bik", "fl_vru_mot", "fl_ar_teen", "fl_ar_ag",
    "flag_imp", "latitude", "longitude", "xcoordinat", "ycoordinat", "coordsys"
]

# Load the CSV, force column names to lowercase
try:
    df = pd.read_csv(input_csv, low_memory=False)

    # Rename all columns to lowercase
    df.columns = df.columns.str.lower()

    # Filter only the required columns
    df_filtered = df[columns_to_keep]

    # Save the filtered data to a new CSV file
    df_filtered.to_csv(output_csv, index=False)
    
    print(f"✅ Successfully extracted the required fields into '{output_csv}'")

except KeyError as e:
    print(f"❌ Error: Some required columns are missing in the input file: {e}")
    print("Make sure the input CSV contains the specified columns.")