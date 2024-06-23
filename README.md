# EasyAI 

🔧 ```npm i -g @massudy/easyai```

‎ 🌎 ```ai```

# Flash
 📟 `do`
 
💬 ```chat```

💡 ```generate```

🌐 ```webgpt```

# Default Usage
```
npm i @massudy/easyai
```
## ⚙️ Requirements

<details>
  <summary>🐧 CentOS7.x</summary>

1. Install scl repo:
   <pre>
   sudo yum install -y centos-release-scl
   </pre>

2. Install devtoolset 11:
   <pre>
   sudo yum install -y devtoolset-11
   </pre>

3. Enable GCC version:
   <pre>
   source /opt/rh/devtoolset-11/enable
   </pre>
   Add the above line in `~/.bashrc` and refresh:
   <pre>
   source ~/.bashrc
   </pre>

4. Check the version:
   <pre>
   gcc --version
   </pre>

</details>

<details>
  <summary>🖥️ Windows</summary>

1. Download the latest fortran version of [w64devkit](https://github.com/skeeto/w64devkit/releases)

2. Extract and add the bin to PATH global variable:
   <pre>
   setx path "%path%;C:\path\to\w64devkit\bin"
   </pre>
   Replace `C:\path\to\w64devkit\bin` with the actual path where you extracted w64devkit.

3. Check command-line:
   <pre>
   gcc --version
   </pre>

</details>

## 🏁 Getting Started
```
import EasyAI from '@massudy/easyai'

const AI = new EasyAI()

console.log(await AI.Generate('The text below is cake recipe'))

// This code will generate a cake recipe
```

---

[Full Doc](https://doc.easyai.com.br)
