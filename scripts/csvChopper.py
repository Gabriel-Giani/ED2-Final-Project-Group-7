import pandas as pd

# Input and output CSV file paths
input_csv = "input.csv"   # Change this to your actual input file
output_csv = "filtered_output.csv"

# List of columns to keep
columns_to_keep = [
    "keyfield1", "crashnum", "casenumber", "agency", "district", "dotcounty", "crashdate", "crashtime",
    "dayofweek", "dhscntycty", "townname", "intownflag", "onroadname", "inroadname", "refdist", "refdirect",
    "roadwayid", "locmilept", "locnode", "srrouteid", "usrouteid", "sideofroad", "crashlane", "roadcatgry",
    "skidnumber", "skidtestdt", "rcifedhwy", "rcifunclas", "rciacc", "rciplacecd", "rcilanduse", "rcisurfwth",
    "rcisldtyp1", "rcisldtyp2", "rcisldtyp3", "rcisldwth1", "rcisldwth2", "rcisldwth3", "rcimedwdth",
    "rciaadt", "rciavgtfct", "rcihzdgcrv", "rcimaxspd", "rcityppark", "highestinj", "crshalcdrg",
    "siteloca", "lightcond", "weathcond", "rdsurfcond", "div_undiv", "trafcntl1", "trafcntl2",
    "cntoflanes", "rdsurftype", "roadcond1", "roadcond2", "visiblty1", "visiblty2", "crshevent1",
    "crshcause1", "cntofinj", "cntoffatl", "cntofsvinj", "cntofpedes", "cntofdrvrs", "cntofcycls",
    "cntofveh", "cntofpers", "cntnontftl", "totcrshdmg", "totvehdmg", "totothrdmg", "workzone",
    "latitude", "longitude", "xcoordinat", "ycoordinat", "coordsys", "mapsource", "mapversion",
    "dtpublishe", "dtcarxtrct", "dtcoordxtr", "linesegid"
]

# Load the CSV
try:
    df = pd.read_csv(input_csv, usecols=columns_to_keep, low_memory=False)
    
    # Save the filtered data to a new CSV file
    df.to_csv(output_csv, index=False)

    print(f"✅ Successfully extracted the required fields into '{output_csv}'")
except ValueError as e:
    print(f"❌ Error: {e}")
    print("Make sure the input CSV contains the specified columns.")