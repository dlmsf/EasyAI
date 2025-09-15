#!/bin/bash

# Configuration
REPO_DIR=$(pwd)
INSTALL_DIR="/usr/local/etc/EasyAI" # Fixed installation directory name
BACKUP_DIR="/usr/local/etc/EasyAI_old_$(date +%s)" # Backup of previous installation
BIN_DIR="/usr/local/bin"
DEB_DIR="$REPO_DIR/core/upack" # Default directory containing .deb files for desktop
DEB_SERVER_DIR="$REPO_DIR/core/upack-server" # Directory containing .deb files for server
PM2_TAR_GZ="$REPO_DIR/core/Hot/pm2.tar.gz" # Path to the pm2 tar.gz file
PM2_EXTRACT_DIR="$INSTALL_DIR/core/Hot/pm2" # Directory where pm2 will be extracted
LOG_FILE="/var/log/EasyAI-install.log"
LOG_MODE=false
SKIP_DEBS=false
LOCAL_DIR_MODE=false # Default to installation directory behavior
PRESERVE_DATA=true # Default to preserving whitelisted files
BUILD_MODE=false # New: Build mode flag
BUILD_COMMIT="" # New: Commit hash for build mode

# Whitelist of files/directories to preserve during updates
declare -a WHITELIST=(
  "models"
  "saves.json"
  "llama.cpp"
  "log.json"
  "config.json"
)

# Commands to create symbolic links
declare -A COMMANDS=(
  ["core/Flash/WebGPTFlash.js"]="webgpt"
  ["core/Flash/GenerateFlash.js"]="generate"
  ["core/Flash/ChatFlash.js"]="chat"
  ["core/MenuCLI/MenuCLI.js"]="ai"
  ["core/Hot/pm2/bin/pm2"]="pm2" # Correct path for pm2
)

# New: Function to get the latest commit hash
get_latest_commit() {
  git log --format="%H" -n 1
}

# New: Function to handle build mode
handle_build_mode() {
  local commit_hash="$1"
  local build_dir="$REPO_DIR/build"
  
  # Determine commit hash if not provided
  if [[ -z "$commit_hash" ]]; then
    commit_hash=$(get_latest_commit)
    echo "📋 No commit specified, using latest commit: ${commit_hash:0:7}..."
  fi
  
  local output_dir="$build_dir/$commit_hash"
  
  # Validate git repository
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository"
    exit 1
  fi

  # Validate commit exists
  if ! git cat-file -e "$commit_hash^{commit}" 2>/dev/null; then
    echo "❌ Error: Commit '$commit_hash' does not exist"
    echo "Available commits (last 10):"
    git log --oneline -10
    exit 1
  fi

  # Create build directory
  mkdir -p "$build_dir"

  # Handle existing directory
  if [[ -d "$output_dir" ]]; then
    echo "⚠️  Directory '$output_dir' already exists, overwriting..."
    rm -rf "$output_dir"
  fi

  mkdir -p "$output_dir"

  echo "📦 Creating build snapshot of commit: ${commit_hash:0:7}..."

  # Export using git archive (cleanest method)
  git archive --format=tar "$commit_hash" | tar -x -C "$output_dir"

  echo "✅ Successfully created build: $output_dir"
  echo "📁 Contents exported without .git history"

  # Show info about the commit
  echo ""
  echo "📝 Commit info:"
  git show -s --format="%h - %s (%an, %ad)" "$commit_hash"
  echo "📍 Path: $output_dir"
  
  exit 0
}

show_help() {
  # Define color codes
  local RED='\e[31m'
  local GREEN='\e[32m'
  local YELLOW='\e[33m'
  local BLUE='\e[34m'
  local BOLD='\e[1m'
  local RESET='\e[0m'

  echo -e "${BLUE}${BOLD}EasyAI Installation Script${RESET}\n"

  echo -e "${YELLOW}${BOLD}DESCRIPTION:${RESET}"
  echo -e "  This script installs the EasyAI package and its dependencies."
  echo -e "  It handles both Ubuntu Desktop and Server variants, installs required .deb packages,"
  echo -e "  sets up symbolic links for commands, and provides installation logging.\n"

  echo -e "${YELLOW}${BOLD}USAGE:${RESET}"
  echo -e "  $0 [OPTIONS]\n"

  echo -e "${YELLOW}${BOLD}OPTIONS:${RESET}"
  echo -e "  ${GREEN}-h, --help${RESET}       Show this help message and exit"
  echo -e "  ${RED}-log${RESET}             Enable installation logging to ${LOG_FILE}"
  echo -e "  ${RED}--skip-debs${RESET}      Skip installation of .deb packages (${YELLOW}warning:${RESET} may affect functionality)"
  echo -e "  ${GREEN}--local-dir${RESET}     Run commands from current directory instead of installation directory"
  echo -e "  ${RED}--no-preserve${RESET}    Don't preserve whitelisted files during update"
  echo -e "  ${GREEN}--build${RESET}         [NEW] Create build snapshot of specific commit (optional: provide commit hash)"
  echo -e "  ${GREEN}--build <commit>${RESET} [NEW] Create build snapshot of specific commit hash\n"

  echo -e "${YELLOW}${BOLD}PRESERVED FILES:${RESET}"
  echo -e "  The following files/directories are preserved during updates:"
  for item in "${WHITELIST[@]}"; do
    echo -e "  - $item"
  done
  echo -e "  Use ${RED}--no-preserve${RESET} to disable this behavior\n"

  echo -e "${YELLOW}${BOLD}COMMANDS CREATED:${RESET}"
  echo -e "  webgpt           WebGPT interface"
  echo -e "  generate         Content generation tool"
  echo -e "  chat             Chat interface"
  echo -e "  ai               Main AI command menu"
  echo -e "  pm2              Process manager for Node.js\n"

  echo -e "${YELLOW}${BOLD}BEHAVIOR:${RESET}"
  echo -e "  By default, commands will run from the installation directory (${INSTALL_DIR})"
  echo -e "  Use ${GREEN}--local-dir${RESET} to make commands run from the current directory instead\n"

  echo -e "${YELLOW}${BOLD}NEW BUILD MODE:${RESET}"
  echo -e "  Use ${GREEN}--build${RESET} to create a clean snapshot of the latest commit"
  echo -e "  Use ${GREEN}--build <commit-hash>${RESET} to create a snapshot of specific commit"
  echo -e "  Builds are saved in ./build/<commit-hash> directory\n"

  echo -e "${YELLOW}${BOLD}EXAMPLES:${RESET}"
  echo -e "  Normal installation:        $0"
  echo -e "  Installation with logging:  $0 ${RED}-log${RESET}"
  echo -e "  Skip .deb installation:     $0 ${RED}--skip-debs${RESET}"
  echo -e "  Local directory behavior:   $0 ${GREEN}--local-dir${RESET}"
  echo -e "  No file preservation:      $0 ${RED}--no-preserve${RESET}"
  echo -e "  Build latest commit:       $0 ${GREEN}--build${RESET}"
  echo -e "  Build specific commit:     $0 ${GREEN}--build abc123def456${RESET}\n"

  echo -e "${YELLOW}${BOLD}NOTE:${RESET}"
  echo -e "  If you modify this script or add new parameters, please update this help section."
  echo -e "  For AI-assisted rewrites, ensure documentation remains complete and accurate."
  exit 0
}

# Function to detect Ubuntu variant
detect_ubuntu_variant() {
  if [[ $(dpkg -l | grep ubuntu-desktop | wc -l) -gt 0 ]]; then
    echo "desktop"
  else
    echo "server"
  fi
}

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
  if [[ "$SKIP_DEBS" == true ]]; then
    log_message "Skipping .deb installation as requested."
    return
  fi

  local variant=$(detect_ubuntu_variant)
  local deb_dir="$DEB_DIR"
  
  if [[ "$variant" == "server" ]]; then
    deb_dir="$DEB_SERVER_DIR"
    log_message "Ubuntu Server detected. Using server-specific .deb packages."
  else
    log_message "Ubuntu Desktop detected. Using standard .deb packages."
  fi

  if [[ -d "$deb_dir" ]]; then
    local deb_files=("$deb_dir"/*.deb)
    if [[ ${#deb_files[@]} -gt 0 ]]; then
      log_message "Installing .deb packages from $deb_dir..."
      if [[ "$LOG_MODE" == true ]]; then
        sudo dpkg -i "${deb_files[@]}" &
      else
        sudo dpkg -i "${deb_files[@]}" > /dev/null 2>&1 &
      fi
      show_progress "Installing dependencies" $!
    else
      log_message "No .deb files found in $deb_dir. Skipping .deb installation."
    fi
  else
    log_message "The .deb directory ($deb_dir) does not exist. Skipping .deb installation."
  fi
}

# Function to copy files
copy_files() {
  local src_dir="$1"
  local dest_dir="$2"

  mkdir -p "$dest_dir"

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

# Function to preserve whitelisted files by moving them from backup
preserve_files_from_backup() {
  if [[ "$PRESERVE_DATA" == false ]]; then
    log_message "Skipping file preservation as requested."
    return
  fi

  if [[ -d "$BACKUP_DIR" ]]; then
    log_message "Restoring whitelisted files from backup..."
    
    for item in "${WHITELIST[@]}"; do
      local source_path="$BACKUP_DIR/$item"
      local dest_path="$INSTALL_DIR/$item"
      
      if [[ -e "$source_path" ]]; then
        log_message "Restoring $item..."
        local dest_dir="$(dirname "$dest_path")"
        mkdir -p "$dest_dir"
        
        # Remove existing destination if it exists
        if [[ -e "$dest_path" ]]; then
          rm -rf "$dest_path"
        fi
        
        # Move file/directory from backup to new installation
        mv -f "$source_path" "$dest_path"
      fi
    done
    
    # Clean up backup directory
    log_message "Cleaning up backup directory..."
    rm -rf "$BACKUP_DIR"
  fi
}

# Function to create command wrappers or direct symlinks
create_command_links() {
  local install_dir="$1"
  
  for src in "${!COMMANDS[@]}"; do
    src_path="$install_dir/$src"
    dest_path="$BIN_DIR/${COMMANDS[$src]}"
    
    if [[ "$LOCAL_DIR_MODE" == true ]]; then
      # Direct symlink mode (current directory behavior)
      log_message "Creating direct symlink for ${COMMANDS[$src]}..."
      [[ -L "$dest_path" ]] && rm "$dest_path"
      ln -s "$src_path" "$dest_path"
      chmod 755 "$src_path"
    else
      # Wrapper mode (installation directory behavior)
      wrapper_path="$install_dir/wrappers/${COMMANDS[$src]}"
      mkdir -p "$(dirname "$wrapper_path")"
      
      log_message "Creating wrapper for ${COMMANDS[$src]}..."
      
      # Create the wrapper script
      cat > "$wrapper_path" <<EOF
#!/bin/bash
cd "$install_dir" || { echo "Error: Could not change to installation directory $install_dir" >&2; exit 1; }
exec node "$src_path" "\$@"
EOF

      # Make the wrapper executable
      chmod +x "$wrapper_path"

      # Create the symlink to the wrapper
      [[ -L "$dest_path" ]] && rm "$dest_path"
      ln -s "$wrapper_path" "$dest_path"
    fi
  done
}

# Trap to handle Ctrl+C
trap 'log_message "Installation interrupted. Running dpkg --configure -a..."; sudo dpkg --configure -a; exit 1' INT

# Check for help arguments first
for arg in "$@"; do
  case "$arg" in
    -h|--help)
      show_help
      ;;
  esac
done

# New: Check for build mode first (should take precedence over other modes)
for ((i=1; i<=$#; i++)); do
  if [[ "${!i}" == "--build" ]]; then
    BUILD_MODE=true
    # Check if next argument exists and is not another option
    if [[ $((i+1)) -le $# && ! "${@:i+1:1}" =~ ^- ]]; then
      BUILD_COMMIT="${@:i+1:1}"
    fi
    handle_build_mode "$BUILD_COMMIT"
  fi
done

# Check for other arguments
for arg in "$@"; do
  case "$arg" in
    -log)
      LOG_MODE=true
      touch "$LOG_FILE"
      ;;
    --skip-debs)
      SKIP_DEBS=true
      ;;
    --local-dir)
      LOCAL_DIR_MODE=true
      log_message "Local directory mode enabled - commands will run from current directory"
      ;;
    --no-preserve)
      PRESERVE_DATA=false
      log_message "File preservation disabled - whitelisted files will not be saved"
      ;;
  esac
done

# Install .deb packages
install_debs

# Run dpkg --configure -a if not skipping deb installation
if [[ "$SKIP_DEBS" == false ]]; then
  log_message "Running dpkg --configure -a..."
  if [[ "$LOG_MODE" == true ]]; then
    sudo dpkg --configure -a &
    else
    sudo dpkg --configure -a > /dev/null 2>&1 &
  fi
  show_progress "Configuring packages" $!
fi

# Check if the installation directory already exists
if [[ -d "$INSTALL_DIR" ]]; then
  log_message "The EasyAI folder already exists. Choose an option:"
  log_message "1. Update (replace existing files)"
  log_message "2. Remove (delete the existing folder and symbolic links)"
  log_message "3. Exit (cancel setup)"

  read -p "Enter your choice (1/2/3): " choice
  case "$choice" in
    1)
      log_message "Updating the existing installation..."
      # Rename existing installation to backup location
      mv -f "$INSTALL_DIR" "$BACKUP_DIR"
      remove_links
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
mkdir -p "$INSTALL_DIR"
show_progress "Creating installation directory" $!

log_message "Copying files..."
copy_files "$REPO_DIR" "$INSTALL_DIR"

# Restore preserved files from backup if this was an update
preserve_files_from_backup

# Extract the pm2 tar.gz file
if [[ -f "$PM2_TAR_GZ" ]]; then
  log_message "Extracting $PM2_TAR_GZ to $PM2_EXTRACT_DIR..."
  mkdir -p "$PM2_EXTRACT_DIR"
  tar -xzf "$PM2_TAR_GZ" -C "$PM2_EXTRACT_DIR" --strip-components=1 > /dev/null 2>&1 &
  show_progress "Extracting pm2" $!
else
  log_message "The pm2 tar.gz file ($PM2_TAR_GZ) does not exist. Skipping extraction."
fi

# Create command links (either wrappers or direct symlinks based on mode)
create_command_links "$INSTALL_DIR"

log_message "Setup complete. You can now use the commands globally."

if [[ "$LOCAL_DIR_MODE" == true ]]; then
  log_message "Note: Commands will run from your current directory (--local-dir mode)"
else
  log_message "Note: Commands will run from the installation directory ($INSTALL_DIR)"
fi

if [[ "$PRESERVE_DATA" == true && -d "$BACKUP_DIR" ]]; then
  log_message "Note: Whitelisted files were preserved during update"
fi