import re
path = "/home/daytona/pterodactyl-panel/.env"
with open(path, "r") as f:
    lines = f.readlines()
new_lines = []
found = False
for line in lines:
    if line.startswith("APP_NAME="):
        new_lines.append('APP_NAME="Death Legion"\n')
        found = True
    else:
        new_lines.append(line)
if not found:
    new_lines.insert(0, 'APP_NAME="Death Legion"\n')
with open(path, "w") as f:
    f.writelines(new_lines)
# Verify
with open(path, "r") as f:
    for line in f:
        if line.startswith("APP_NAME"):
            print("APP_NAME:", line.strip())
            break
