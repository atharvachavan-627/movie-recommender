import glob
import re

jsx_files = glob.glob(r'c:\Users\ATHARVA\Desktop\movie-recommender\frontend\src\**\*.jsx', recursive=True)

print(f"Found {len(jsx_files)} JSX files.")

for fpath in jsx_files:
    content = open(fpath, 'r', encoding='utf-8').read()
    # Find style={{ ... }} blocks
    # match style={{ ... }}
    style_blocks = re.findall(r'style=\{\{(.*?)\}\}', content, re.DOTALL)
    for block in style_blocks:
        lines = block.split('\n')
        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith('//'):
                continue
            # match unquoted key followed by colon
            key_match = re.search(r'^([a-zA-Z0-9_-]+)\s*:', line_str)
            if key_match:
                key = key_match.group(1)
                if '-' in key and not key.startswith('--'):
                    print(f"INVALID KEY in {fpath}: '{key}' in line: {line_str}")
