#!/bin/bash

# Configuration
REPO_DIR=$(pwd)
FOLDER_NAME=$(basename "$REPO_DIR")
INSTALL_DIR="/usr/local/etc/$FOLDER_NAME" # Installation folder named after the current directory
BIN_DIR="/usr/local/bin"
DEB_DIR="$REPO_DIR/core/upack" # Directory containing .deb files
PM2_TAR_GZ="$REPO_DIR/core/Hot/pm2.tar.gz" # Path to the pm2 tar.gz file
PM2_EXTRACT_DIR="$INSTALL_DIR/core/Hot/pm2" # Directory where pm2 will be extracted
LOG_FILE="/var/log/$FOLDER_NAME-install.log"
LOG_MODE=false

# Commands to create symbolic links
declare -A COMMANDS=(
  ["core/Flash/WebGPTFlash.js"]="webgpt"
  ["core/Flash/GenerateFlash.js"]="generate"
  ["core/Flash/ChatFlash.js"]="chat"
  ["core/MenuCLI/MenuCLI.js"]="ai"
  ["core/Hot/pm2/bin/pm2"]="pm2" # Correct path for pm2
)

# Function to log messages
log_message() {
  if [[ "$LOG_MODE" == true ]]; then
    echo "$1" | tee -a "$LOG_FILE"
  else
    echo "$1"
  fi
}

# Function to show progress and allow skipping
show_progress() {
  local message="$1"
  local pid="$2"
  while kill -0 $pid 2>/dev/null; do
    echo -ne "$message (press x to skip)\r"
    read -t 1 -n 1 -s input
    if [[ $input == "x" ]]; then
      echo -e "\nSkipping step..."
      kill $pid
      wait $pid 2>/dev/null
      break
    fi
  done
  wait $pid 2>/dev/null
  echo -e "\n$message completed."
}

# Function to install .deb packages
install_debs() {
  if [[ -d "$DEB_DIR" ]]; then
    local deb_files=("$DEB_DIR"/*.deb)
    if [[ ${#deb_files[@]} -gt 0 ]]; then
      log_message "Installing .deb packages from $DEB_DIR..."
      if [[ "$LOG_MODE" == true ]]; then
        sudo dpkg -i "${deb_files[@]}" &
      else
        sudo dpkg -i "${deb_files[@]}" > /dev/null 2>&1 &
      fi
      show_progress "Installing dependencies" $!
    else
      log_message "No .deb files found in $DEB_DIR. Skipping .deb installation."
    fi
  else
    log_message "The .deb directory ($DEB_DIR) does not exist. Skipping .deb installation."
  fi
}

# Function to copy files
copy_files() {
  local src_dir="$1"
  local dest_dir="$2"

  # Ensure destination directory exists
  mkdir -p "$dest_dir"

  # Calculate total size of files to be copied (excluding ignored files)
  local total_size
  total_size=$(rsync -a --dry-run --stats --exclude-from="$src_dir/.gitignore" "$src_dir/" "$dest_dir" | grep "Total file size" | awk '{print $4}')

  # Convert total size to MB for display
  local total_size_mb=$(awk "BEGIN {printf \"%.2f\", $total_size/1024/1024}")

  # Run rsync with progress and respect .gitignore
  log_message "Starting file copy with progress tracking..."
  if [[ "$LOG_MODE" == true ]]; then
    rsync -a --info=progress2 --exclude-from="$src_dir/.gitignore" "$src_dir/" "$dest_dir" &
  else
    rsync -a --info=progress2 --exclude-from="$src_dir/.gitignore" "$src_dir/" "$dest_dir" > /dev/null 2>&1 &
  fi
  show_progress "Copying files" $!
}

# Function to remove symbolic links
remove_links() {
  for dest in "${COMMANDS[@]}"; do
    dest_path="$BIN_DIR/$dest"
    if [[ -L "$dest_path" ]]; then
      log_message "Removing symbolic link: $dest_path"
      rm "$dest_path"
    else
      log_message "Symbolic link not found: $dest_path"
    fi
  done
}

# Trap to handle Ctrl+C and run dpkg --configure -a
trap 'log_message "Installation interrupted. Running dpkg --configure -a..."; sudo dpkg --configure -a; exit 1' INT

# Check for logging mode
if [[ "$1" == "-log" ]]; then
  LOG_MODE=true
  touch "$LOG_FILE"
fi

# Install .deb packages
install_debs

# Run dpkg --configure -a
log_message "Running dpkg --configure -a..."
if [[ "$LOG_MODE" == true ]]; then
  sudo dpkg --configure -a &
else
  sudo dpkg --configure -a > /dev/null 2>&1 &
fi
show_progress "Configuring packages" $!

# Check if the installation directory already exists
if [[ -d "$INSTALL_DIR" ]]; then
  log_message "The folder '$FOLDER_NAME' already exists. Choose an option:"
  log_message "1. Update (replace existing files)"
  log_message "2. Remove (delete the existing folder and symbolic links)"
  log_message "3. Exit (cancel setup)"

  read -p "Enter your choice (1/2/3): " choice
  case "$choice" in
    1)
      log_message "Updating the existing installation..."
      remove_links
      rm -rf "$INSTALL_DIR"
      ;;
    2)
      log_message "Removing the existing folder and symbolic links..."
      remove_links
      rm -rf "$INSTALL_DIR"
      log_message "Folder and symbolic links removed. Setup cancelled."
      exit 0
      ;;
    3)
      log_message "Setup cancelled."
      exit 0
      ;;
    *)
      log_message "Invalid choice. Setup cancelled."
      exit 1
      ;;
  esac
fi

# Proceed with global installation
log_message "Creating installation directory..."
if [[ "$LOG_MODE" == true ]]; then
  mkdir -p "$INSTALL_DIR" &
else
  mkdir -p "$INSTALL_DIR" > /dev/null 2>&1 &
fi
show_progress "Creating installation directory" $!

log_message "Copying files..."
copy_files "$REPO_DIR" "$INSTALL_DIR"

# Extract the pm2 tar.gz file
if [[ -f "$PM2_TAR_GZ" ]]; then
  log_message "Extracting $PM2_TAR_GZ to $PM2_EXTRACT_DIR..."
  mkdir -p "$PM2_EXTRACT_DIR"
  if [[ "$LOG_MODE" == true ]]; then
    tar -xzf "$PM2_TAR_GZ" -C "$PM2_EXTRACT_DIR" --strip-components=1 &
  else
    tar -xzf "$PM2_TAR_GZ" -C "$PM2_EXTRACT_DIR" --strip-components=1 > /dev/null 2>&1 &
  fi
  show_progress "Extracting pm2" $!
else
  log_message "The pm2 tar.gz file ($PM2_TAR_GZ) does not exist. Skipping extraction."
fi

# Remove any existing pm2 file or symbolic link in /usr/local/bin
if [[ -e "$BIN_DIR/pm2" ]]; then
  log_message "Removing existing pm2 file or symbolic link in $BIN_DIR..."
  rm "$BIN_DIR/pm2"
fi

for src in "${!COMMANDS[@]}"; do
  src_path="$INSTALL_DIR/$src"
  dest_path="$BIN_DIR/${COMMANDS[$src]}"

  log_message "Creating symbolic link for ${COMMANDS[$src]}..."
  [[ -L "$dest_path" ]] && rm "$dest_path"
  ln -s "$src_path" "$dest_path"

  log_message "Making $src executable..."
  chmod 755 "$src_path"
done

# Verify the pm2 symbolic link
if [[ -L "$BIN_DIR/pm2" ]]; then
  log_message "Symbolic link for pm2 created successfully."
else
  log_message "Failed to create symbolic link for pm2."
fi

log_message "Setup complete. You can now use the commands globally."
