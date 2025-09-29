#!/bin/sh

# Configuration
REPO_DIR=$(pwd)
INSTALL_DIR="/usr/local/etc/EasyAI"
BACKUP_DIR="/usr/local/etc/EasyAI_old_$(date +%s)"
BIN_DIR="/usr/local/bin"
DEB_DIR="$REPO_DIR/core/upack"
DEB_SERVER_DIR="$REPO_DIR/core/upack-server"
APK_DIR="$REPO_DIR/core/apk"
PM2_TAR_GZ="$REPO_DIR/core/Hot/pm2.tar.gz"
PM2_EXTRACT_DIR="$INSTALL_DIR/core/Hot/pm2"
LOG_FILE="/var/log/EasyAI-install.log"
LOG_MODE=false
SKIP_PKGS=false
LOCAL_DIR_MODE=false
PRESERVE_DATA=true
BUILD_MODE=false
BUILD_COMMIT=""

# Detect OS type
detect_os() {
  if [ -f /etc/alpine-release ]; then
    echo "alpine"
  elif [ -f /etc/debian_version ] || [ -f /etc/lsb-release ] || [ -f /etc/os-release ] && grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
    echo "ubuntu"
  else
    echo "unknown"
  fi
}

OS_TYPE=$(detect_os)

# Whitelist of files/directories to preserve during updates
WHITELIST="
models
saves.json
llama.cpp
log.json
config.json
"

# Commands to create symbolic links
COMMANDS="
core/Flash/WebGPTFlash.js:webgpt
core/Flash/GenerateFlash.js:generate
core/Flash/ChatFlash.js:chat
core/MenuCLI/MenuCLI.js:ai
core/Hot/pm2/bin/pm2:pm2
"

# New: Function to get the latest commit hash
get_latest_commit() {
  git log --format="%H" -n 1 2>/dev/null || echo ""
}

# New: Function to handle build mode
handle_build_mode() {
  commit_hash="$1"
  build_dir="$REPO_DIR/build"
  
  # Determine commit hash if not provided
  if [ -z "$commit_hash" ]; then
    commit_hash=$(get_latest_commit)
    if [ -n "$commit_hash" ]; then
      short_hash=$(echo "$commit_hash" | cut -c1-7)
      echo "No commit specified, using latest commit: $short_hash..."
    else
      echo "Error: Not a git repository or no commits found"
      exit 1
    fi
  fi
  
  output_dir="$build_dir/$commit_hash"
  
  # Validate git repository
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not a git repository"
    exit 1
  fi

  # Validate commit exists
  if ! git cat-file -e "$commit_hash^{commit}" 2>/dev/null; then
    echo "Error: Commit '$commit_hash' does not exist"
    echo "Available commits (last 10):"
    git log --oneline -10 2>/dev/null || echo "No git history available"
    exit 1
  fi

  # Create build directory
  mkdir -p "$build_dir"

  # Handle existing directory
  if [ -d "$output_dir" ]; then
    echo "Directory '$output_dir' already exists, overwriting..."
    rm -rf "$output_dir"
  fi

  mkdir -p "$output_dir"

  short_hash=$(echo "$commit_hash" | cut -c1-7)
  echo "Creating build snapshot of commit: $short_hash..."

  # Export using git archive (cleanest method)
  if git archive --format=tar "$commit_hash" | tar -x -C "$output_dir"; then
    echo "Successfully created build: $output_dir"
    echo "Contents exported without .git history"

    # Show info about the commit
    echo ""
    echo "Commit info:"
    git show -s --format="%h - %s (%an, %ad)" "$commit_hash"
    echo "Path: $output_dir"
  else
    echo "Error: Failed to create build snapshot"
    exit 1
  fi
  
  exit 0
}

show_help() {
  echo "=== EasyAI Installation Script ==="
  echo ""
  echo "DESCRIPTION:"
  echo "  This script installs the EasyAI package and its dependencies."
  echo "  It handles both Ubuntu and Alpine Linux, installs required packages,"
  echo "  sets up symbolic links for commands, and provides installation logging."
  echo ""
  echo "USAGE:"
  echo "  $0 [OPTIONS]"
  echo ""
  echo "OPTIONS:"
  echo "  -h, --help       Show this help message and exit"
  echo "  -log             Enable installation logging to $LOG_FILE"
  echo "  --skip-pkgs      Skip installation of packages (warning: may affect functionality)"
  echo "  --local-dir      Run commands from current directory instead of installation directory"
  echo "  --no-preserve    Don't preserve whitelisted files during update"
  echo "  --build          Create build snapshot of specific commit (optional: provide commit hash)"
  echo "  --build <commit> Create build snapshot of specific commit hash"
  echo ""
  echo "PRESERVED FILES:"
  echo "  The following files/directories are preserved during updates:"
  for item in $WHITELIST; do
    echo "  - $item"
  done
  echo "  Use --no-preserve to disable this behavior"
  echo ""
  echo "COMMANDS CREATED:"
  echo "  webgpt           WebGPT interface"
  echo "  generate         Content generation tool"
  echo "  chat             Chat interface"
  echo "  ai               Main AI command menu"
  echo "  pm2              Process manager for Node.js"
  echo ""
  echo "BEHAVIOR:"
  echo "  By default, commands will run from the installation directory ($INSTALL_DIR)"
  echo "  Use --local-dir to make commands run from the current directory instead"
  echo ""
  echo "NEW BUILD MODE:"
  echo "  Use --build to create a clean snapshot of the latest commit"
  echo "  Use --build <commit-hash> to create a snapshot of specific commit"
  echo "  Builds are saved in ./build/<commit-hash> directory"
  echo ""
  echo "EXAMPLES:"
  echo "  Normal installation:        $0"
  echo "  Installation with logging:  $0 -log"
  echo "  Skip package installation:  $0 --skip-pkgs"
  echo "  Local directory behavior:   $0 --local-dir"
  echo "  No file preservation:      $0 --no-preserve"
  echo "  Build latest commit:       $0 --build"
  echo "  Build specific commit:     $0 --build abc123def456"
  echo ""
  echo "NOTE:"
  echo "  If you modify this script or add new parameters, please update this help section."
  exit 0
}

# Function to detect Ubuntu variant
detect_ubuntu_variant() {
  if command -v dpkg >/dev/null 2>&1 && dpkg -l | grep -q "ubuntu-desktop"; then
    echo "desktop"
  else
    echo "server"
  fi
}

# Function to log messages
log_message() {
  if [ "$LOG_MODE" = true ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
  else
    echo "$1"
  fi
}

# Function to show progress and allow skipping
show_progress() {
  message="$1"
  pid="$2"
  count=0
  spinner="/-\\|"
  
  while kill -0 "$pid" 2>/dev/null; do
    count=$((count + 1))
    # Show spinner every 10 iterations to reduce CPU usage
    if [ $((count % 10)) -eq 0 ]; then
      spin_char=$(printf "%.1s" "$spinner" | cut -c$(( (count % 4) + 1 )))
      printf "\r%s %s (press x to skip)" "$message" "$spin_char"
    fi
    
    # Check for user input with timeout
    if read -t 0.1 -n 1 -s input 2>/dev/null; then
      if [ "$input" = "x" ]; then
        printf "\nSkipping step...\n"
        kill "$pid" 2>/dev/null
        wait "$pid" 2>/dev/null
        break
      fi
    fi
  done
  wait "$pid" 2>/dev/null
  printf "\r%s completed.                      \n" "$message"
}

# Function to install packages based on OS
install_packages() {
  if [ "$SKIP_PKGS" = true ]; then
    log_message "Skipping package installation as requested."
    return
  fi

  case "$OS_TYPE" in
    "ubuntu")
      install_debs
      ;;
    "alpine")
      install_apks
      ;;
    *)
      log_message "Unknown OS type. Skipping package installation."
      ;;
  esac
}

# Function to install .deb packages
install_debs() {
  variant=$(detect_ubuntu_variant)
  deb_dir="$DEB_DIR"
  
  if [ "$variant" = "server" ]; then
    deb_dir="$DEB_SERVER_DIR"
    log_message "Ubuntu Server detected. Using server-specific .deb packages."
  else
    log_message "Ubuntu Desktop detected. Using standard .deb packages."
  fi

  if [ -d "$deb_dir" ]; then
    deb_files=$(find "$deb_dir" -maxdepth 1 -name "*.deb" 2>/dev/null | tr '\n' ' ')
    if [ -n "$deb_files" ]; then
      log_message "Installing .deb packages from $deb_dir..."
      if [ "$LOG_MODE" = true ]; then
        sudo dpkg -i $deb_files &
      else
        sudo dpkg -i $deb_files > /dev/null 2>&1 &
      fi
      show_progress "Installing dependencies" $!
    else
      log_message "No .deb files found in $deb_dir. Skipping .deb installation."
    fi
  else
    log_message "The .deb directory ($deb_dir) does not exist. Skipping .deb installation."
  fi
}

# Function to install .apk packages
install_apks() {
  if [ -d "$APK_DIR" ]; then
    apk_files=$(find "$APK_DIR" -maxdepth 1 -name "*.apk" 2>/dev/null | tr '\n' ' ')
    if [ -n "$apk_files" ]; then
      log_message "Installing .apk packages from $APK_DIR..."
      if [ "$LOG_MODE" = true ]; then
        apk add --allow-untrusted $apk_files &
      else
        apk add --allow-untrusted $apk_files > /dev/null 2>&1 &
      fi
      show_progress "Installing dependencies" $!
    else
      log_message "No .apk files found in $APK_DIR. Skipping .apk installation."
    fi
  else
    log_message "The .apk directory ($APK_DIR) does not exist. Skipping .apk installation."
  fi
}

# Function to copy files (using cp instead of tar for better compatibility)
copy_files() {
  src_dir="$1"
  dest_dir="$2"

  mkdir -p "$dest_dir"
  log_message "Starting file copy..."

  # Use cp for copying files (more reliable on Alpine)
  if [ "$LOG_MODE" = true ]; then
    # Copy with verbose output for logging
    (cd "$src_dir" && find . -type f -exec cp -v --parents {} "$dest_dir" \;) &
  else
    # Silent copy
    (cd "$src_dir" && find . -type f -exec cp --parents {} "$dest_dir" \; 2>/dev/null) &
  fi
  
  show_progress "Copying files" $!
  
  # Count files to verify copy was successful
  src_count=$(find "$src_dir" -type f | wc -l)
  dest_count=$(find "$dest_dir" -type f | wc -l)
  
  if [ "$src_count" -eq "$dest_count" ]; then
    log_message "Successfully copied $src_count files."
  else
    log_message "File count mismatch: source has $src_count files, destination has $dest_count files."
    log_message "This may be normal if some files were excluded during copy."
  fi
}

# Function to remove symbolic links
remove_links() {
  echo "$COMMANDS" | while IFS= read -r line; do
    if [ -n "$line" ]; then
      src=$(echo "$line" | cut -d: -f1)
      dest=$(echo "$line" | cut -d: -f2)
      dest_path="$BIN_DIR/$dest"
      if [ -L "$dest_path" ]; then
        log_message "Removing symbolic link: $dest_path"
        rm "$dest_path"
      else
        log_message "Symbolic link not found: $dest_path"
      fi
    fi
  done
}

# Function to preserve whitelisted files by moving them from backup
preserve_files_from_backup() {
  if [ "$PRESERVE_DATA" = false ]; then
    log_message "Skipping file preservation as requested."
    return
  fi

  if [ -d "$BACKUP_DIR" ]; then
    log_message "Restoring whitelisted files from backup..."
    
    for item in $WHITELIST; do
      source_path="$BACKUP_DIR/$item"
      dest_path="$INSTALL_DIR/$item"
      
      if [ -e "$source_path" ]; then
        log_message "Restoring $item..."
        dest_dir=$(dirname "$dest_path")
        mkdir -p "$dest_dir"
        
        # Remove existing destination if it exists
        if [ -e "$dest_path" ]; then
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
  install_dir="$1"
  
  echo "$COMMANDS" | while IFS= read -r line; do
    if [ -n "$line" ]; then
      src=$(echo "$line" | cut -d: -f1)
      dest=$(echo "$line" | cut -d: -f2)
      src_path="$install_dir/$src"
      dest_path="$BIN_DIR/$dest"
      
      if [ "$LOCAL_DIR_MODE" = true ]; then
        # Direct symlink mode (current directory behavior)
        log_message "Creating direct symlink for $dest..."
        [ -L "$dest_path" ] && rm "$dest_path"
        ln -s "$src_path" "$dest_path"
        chmod 755 "$src_path"
      else
        # Wrapper mode (installation directory behavior)
        wrapper_path="$install_dir/wrappers/$dest"
        mkdir -p "$(dirname "$wrapper_path")"
        
        log_message "Creating wrapper for $dest..."
        
        # Create the wrapper script
        cat > "$wrapper_path" <<EOF
#!/bin/sh
cd "$install_dir" || { echo "Error: Could not change to installation directory $install_dir" >&2; exit 1; }
exec node "$src_path" "\$@"
EOF

        # Make the wrapper executable
        chmod +x "$wrapper_path"

        # Create the symlink to the wrapper
        [ -L "$dest_path" ] && rm "$dest_path"
        ln -s "$wrapper_path" "$dest_path"
      fi
    fi
  done
}

# Trap to handle Ctrl+C
trap 'log_message "Installation interrupted."; 
if [ "$OS_TYPE" = "ubuntu" ]; then 
  sudo dpkg --configure -a; 
fi; 
exit 1' INT

# Check for help arguments first
for arg in "$@"; do
  case "$arg" in
    -h|--help)
      show_help
      ;;
  esac
done

# Check for build mode first (should take precedence over other modes)
i=1
for arg in "$@"; do
  if [ "$arg" = "--build" ]; then
    BUILD_MODE=true
    # Check if next argument exists and is not another option
    if [ $((i+1)) -le $# ] && ! echo "$2" | grep -q "^-"; then
      BUILD_COMMIT="$2"
    fi
    handle_build_mode "$BUILD_COMMIT"
  fi
  i=$((i+1))
done

# Check for other arguments
for arg in "$@"; do
  case "$arg" in
    -log)
      LOG_MODE=true
      touch "$LOG_FILE" 2>/dev/null || LOG_MODE=false
      ;;
    --skip-pkgs)
      SKIP_PKGS=true
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

# Install packages based on OS
install_packages

# Run package configuration if not skipping package installation
if [ "$SKIP_PKGS" = false ] && [ "$OS_TYPE" = "ubuntu" ]; then
  log_message "Running dpkg --configure -a..."
  if [ "$LOG_MODE" = true ]; then
    sudo dpkg --configure -a &
  else
    sudo dpkg --configure -a > /dev/null 2>&1 &
  fi
  show_progress "Configuring packages" $!
fi

# Check if the installation directory already exists
if [ -d "$INSTALL_DIR" ]; then
  log_message "The EasyAI folder already exists. Choose an option:"
  log_message "1. Update (replace existing files)"
  log_message "2. Remove (delete the existing folder and symbolic links)"
  log_message "3. Exit (cancel setup)"

  printf "Enter your choice (1/2/3): "
  read choice
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

log_message "Copying files..."
copy_files "$REPO_DIR" "$INSTALL_DIR"

# Restore preserved files from backup if this was an update
preserve_files_from_backup

# Extract the pm2 tar.gz file
if [ -f "$PM2_TAR_GZ" ]; then
  log_message "Extracting $PM2_TAR_GZ to $PM2_EXTRACT_DIR..."
  mkdir -p "$PM2_EXTRACT_DIR"
  tar -xzf "$PM2_TAR_GZ" -C "$PM2_EXTRACT_DIR" --strip-components=1 > /dev/null 2>&1
  log_message "PM2 extraction completed."
else
  log_message "The pm2 tar.gz file ($PM2_TAR_GZ) does not exist. Skipping extraction."
fi

# Create command links (either wrappers or direct symlinks based on mode)
create_command_links "$INSTALL_DIR"

log_message "Setup complete. You can now use the commands globally."

if [ "$LOCAL_DIR_MODE" = true ]; then
  log_message "Note: Commands will run from your current directory (--local-dir mode)"
else
  log_message "Note: Commands will run from the installation directory ($INSTALL_DIR)"
fi

if [ "$PRESERVE_DATA" = true ] && [ -d "$BACKUP_DIR" ]; then
  log_message "Note: Whitelisted files were preserved during update"
fi

log_message "Installation completed successfully!"