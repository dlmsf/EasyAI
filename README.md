# EasyAI

## Requirements
- gcc (GCC) 11.2.1 | CentOS7.x

1° - Install scl repo -> ```sudo yum install -y centos-release-scl```

2° - Install devtoolset 11 -> ```sudo yum install -y devtoolset-11```

3° - Enable the GCC version -> add ```source /opt/rh/devtoolset-11/enable``` to last line in ```nano ~/.bashrc``` and refresh with ```source ~/.bashrc```

4° - Check the version -> ```gcc --version```

## Install
```
npm install @massudy/easyai
```

## Getting Started
```
import EasyAI from '@massudy/easyai'

const AI = new EasyAI()

const generated_text = await AI.Generate('The text below is cake recipe')

console.log(generated_text) 

/*
Expected output : Classic Vanilla Sponge Cake Recipe

Ingredients:
1. 1 cup (240 ml) whole milk, at room temperature
2. 6 large eggs, at room temperature
3. 2 tsp (10 ml) pure vanilla extract
4. 2 1/4 cups (280g) all-purpose flour
5. 1 3/4 cups (350g) granulated sugar
6. 4 tsp baking powder
*/
```
