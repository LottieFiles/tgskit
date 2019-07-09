# TGSKit

Toolkit for dealing with Telegram Stickers and Bodymovin/Lottie animations

## Installation

#### In HTML, import from CDN or from the local Installation:

##### Lottie Player:
- Import from CDN.
```html
<script src="https://unpkg.com/@lottiefiles/tgskit@0.0.4/dist/tgskit.js"></script>
```

- Import from local node_modules directory.
```html
<script src="/node_modules/@lottiefiles/tgskit/dist/tgskit.js"></script>
```

#### In Javascript or TypeScript:

1. Install package using npm or yarn.
```shell
npm install --save @lottiefiles/tgskit
```

2. Import package in your code.
```javascript
import { TGSKit } from '@lottiefiles/tgskit';
```

## Usage

```js
const anim = new TGSKit();

anim.load('http://localhost:1234/bodymovin.json')
  .then(() => {
    const errors = anim.validate();

    if (errors.length === 0) {
      anim.download('sticker');
    } else {
      console.log('Given JSON does not meet requirements for a TGS:');
      console.log(errors);
    }
  })
  .catch(err => {
    console.log('There was an error loading the src resource', err);
  });
```

## Docs

TGSKit class documentation is available in the /docs/ directory.
