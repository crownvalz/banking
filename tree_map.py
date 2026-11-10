import os

# Folders and files to exclude from the map output
IGNORE_DIRS = {'.git', '__pycache__', 'node_modules', '.venv', 'venv'}
IGNORE_FILES = {'.DS_Store', 'tree_map.py', 'directory_map.md'}

def generate_tree(dir_path, prefix=""):
    """Recursively generates a tree structure string of the given directory."""
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return ""

    # Filter out ignored files and directories
    entries = [
        e for e in entries 
        if e not in IGNORE_DIRS and e not in IGNORE_FILES and not e.startswith('.')
    ]

    tree_str = ""
    for index, entry in enumerate(entries):
        path = os.path.join(dir_path, entry)
        is_last = (index == len(entries) - 1)
        connector = "└── " if is_last else "├── "

        tree_str += f"{prefix}{connector}{entry}\n"

        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            tree_str += generate_tree(path, prefix + extension)

    return tree_str

def main():
    root_dir = os.path.abspath(".")
    root_folder_name = os.path.basename(root_dir)
    
    print(f"Scanning directory: {root_dir}\n")
    tree_output = f"{root_folder_name}/\n" + generate_tree(root_dir)
    
    # Print tree to console
    print(tree_output)

    # Save output to a markdown file
    output_filename = "directory_map.md"
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write("```\n")
        f.write(tree_output)
        f.write("```\n")

    print(f"Directory map successfully saved to '{output_filename}'.")

if __name__ == "__main__":
    main()