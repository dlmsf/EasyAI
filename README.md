# EasyAI

🔧 ```npm install -g @massudy/easyai```

‎ 🌎 ```ai```




# Default Usage
```
npm install @massudy/easyai
```
## Requirements
⚙️ **GCC 11.2.1 | CentOS7.x**

‎ 1° - Install scl repo -> ```sudo yum install -y centos-release-scl```

‎ ‎2° - Install devtoolset 11 -> ```sudo yum install -y devtoolset-11```

‎ ‎3° - Enable GCC version -> ```source /opt/rh/devtoolset-11/enable``` in ```nano ~/.bashrc``` and refresh ```source ~/.bashrc```

‎ 4° - Check the version -> ```gcc --version```

⚙️ **Windows**



## Getting Started
```
import EasyAI from '@massudy/easyai'

const AI = new EasyAI()

console.log(await AI.Generate('The text below is cake recipe'))

// This code will generate a cake recipe
```
