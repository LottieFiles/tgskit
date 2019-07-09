import * as pako from 'pako';

interface IValidationError {
  message: string;
  details?: IValidationError[];
}

export class TGSKit {
  private _data: any = {};

  public async load(src: string | object) {
    // Check if src is a string
    if (typeof src === 'string') {
      // Attempt to parse the src string into JSON
      const json = this.parseJSON(src);
      if (json !== false) {
        src = json;
      }

      // Check if the src is a URL
      const url = this.parseURL(src as string);
      if (url !== false) {
        try {
          src = await this.fetchPath(url.toString());
        } catch (err) {
          throw new Error('Error loading remote resource.');
        }
      }
    }

    // Check if src is not an object
    if (typeof src === 'object') {
      return this._data = src;
    }


    throw new Error('Given resource could not be loaded or is invalid.');
  }

  /**
   * Parse a resource into a JSON object
   */
  public parseJSON(src: string): object | false {
    try {
      return JSON.parse(src);
    } catch (e) {
      return false;
    }
  }

  /**
   * Parse a resource into a URL
   */
  public parseURL(src: string): URL | false {
    try {
      return new URL(src);
    } catch (err) {
      return false;
    }
  }

  /**
   * Generate a TGS file and return contents.
   */
  public generate(): any {
    // Add TGS attribute
    this._data.tgs = 1;

    // Remove markers, fonts and chars
    delete this._data.markers;
    delete this._data.fonts;
    delete this._data.chars;

    // GZip
    const gzByteArray = pako.gzip(JSON.stringify(this._data));

    // Create gzip blob
    const blob = new Blob([gzByteArray], { type: 'application/gzip' });

    return blob;
  }

  /**
   * Generates and triggers a download of the TGS file in the browser.
   */
  public download(filename: string = 'data') {
    if (!document) {
      return;
    }

    // Generate gzip and create object URL
    const url = URL.createObjectURL(this.generate());

    var element = document.createElement('a');
    element.setAttribute('href', url);
    element.setAttribute('download', `${filename}.tgs`);
    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  /**
   * Load a resource from a path URL.
   */
  public fetchPath(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, true);
      xhr.responseType = 'arraybuffer';
      xhr.send();
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
          try {
            // Attempt to convert it to JSON as is:

            // Convert arraybuffer to string
            const data = new Uint8Array(xhr.response).reduce((data, byte) => {
              return data + String.fromCharCode(byte);
            }, '');

            // Attempt to parse the data into JSON
            return resolve(JSON.parse(data));
          } catch (err) {
            // Attempt to ungzip response and convert to JSON:
            try {
              const data = pako.inflate(xhr.response, { to: 'string' });
              return resolve(JSON.parse(data));
            } catch (err) {
              return reject(err);
            }
          }
        }
      };
    });
  }

  /**
   * Validates that the Bodymovin JSON meets the requirements for
   * a Telegram Sticker (tgs).
   */
  public validate(): IValidationError[] {
    const errors: IValidationError[] = [];

    if (this._data.fr != 30 && this._data.fr != 60) {
      errors.push({ message: 'Frame rate must be exactly 30 or 60' });
    }

    if (((this._data.op - this._data.ip) / this._data.fr) > 3.0) {
      errors.push({ message: 'Should not be longer than 3 seconds' });
    }

    if (this._data.w != 512 || this._data.h != 512) {
      errors.push({ message: 'Dimensions should be exactly 512pxx512px' });
    }

    if (this._data.ddd != null && this._data.ddd != 0) {
      errors.push({ message: 'Should not have 3D layers' });
    }

    if ('markers' in this._data) {
      // TODO: Is this check necessary?
      // errors.push('Must not have markers');
    }

    if ('assets' in this._data && Array.isArray(this._data.assets)) {
      const assetsErrors: IValidationError[] = [];

      this._data.assets.forEach((asset: any, i: number) => {
        if ('layers' in asset && Array.isArray(asset.layers)) {
          const assetErrors: IValidationError[] = this.checkLayer(asset.layers);

          if (assetErrors.length !== 0) {
            assetsErrors.push({ message: `Asset ${asset.id || i} has errors`, details: assetErrors });
          }
        }
      });

      if (assetsErrors.length !== 0) {
        errors.push({ message: 'Assets must not have errors', details: assetsErrors })
      }
    }

    if ('layers' in this._data && Array.isArray(this._data.layers)) {
      const layersErrors: IValidationError[] = [];

      this._data.layers.forEach((layer: any) => {
        const layerErrors: IValidationError[] = this.checkLayer(layer);

        if (layerErrors.length !== 0) {
          layersErrors.push({ message: `Layer `, details: layerErrors });
        }

        if (layersErrors.length !== 0) {
          errors.push({ message: 'Layers have errors', details: layersErrors })
        }
      });
    } else {
      errors.push({ message: 'Should have atleast 1 layer' });
    }

    if ('fonts' in this._data && Array.isArray(this._data.fonts) && this._data.fonts.length > 0) {
      errors.push({ message: 'Should not have fonts' });
    }

    if ('chars' in this._data && Array.isArray(this._data.chars) && this._data.chars.length > 0) {
      errors.push({ message: 'Should not have glyph chars' });
    }

    if (this.generate().size > 65536) {
      errors.push({ message: 'Total sticker size should not exceed 64 KB' });
    }

    return errors;
  }

  private checkLayer(layer: any): IValidationError[] {
    const errors: IValidationError[] = [];

    if (layer.ddd != null && layer.ddd != 0) {
      errors.push({ message: 'Composition should not include any 3D Layers' });
    }

    if (layer.sr != null && layer.sr != 1) {
      errors.push({ message: 'Composition should not include any Time Stretching' });
    }

    if (layer.tm != null) {
      errors.push({ message: 'Composition should not include any Time Remapping' });
    }

    if (layer.ty === 1) {
      errors.push({ message: 'Composition should not include any Solids' });
    }

    if (layer.ty === 2) {
      errors.push({ message: 'Composition should not include any Images' });
    }

    if (layer.ty === 5) {
      errors.push({ message: 'Composition should not include any Texts' });
    }

    if (layer.hasMask === true || layer.masksProperties != null) {
      errors.push({ message: 'Composition should not include any Masks' });
    }

    if (layer.tt != null) {
      errors.push({ message: 'Composition should not include any Mattes' });
    }

    if (layer.ao === 1) {
      errors.push({ message: 'Composition should not include any Auto-Oriented Layers' });
    }

    if (layer.ef != null) {
      errors.push({ message: 'Composition should not include any Layer Effects' });
    }

    if ('shapes' in layer && Array.isArray(layer.shapes)) {
      const shapesErrors: IValidationError[] = this.checkItems(layer.shapes, true);

      if (shapesErrors.length !== 0) {
        errors.push({ message: 'Composition shapes should not have errors', details: shapesErrors });
      }
    }

    return errors;
  }

  private checkItems(items: any, shapes: any): IValidationError[] {
    const errors: IValidationError[] = [];

    if (items != null) {
      items.forEach((item: any) => {
        if (item.ty == 'rp') {
          errors.push({ message: 'Composition should not include any Repeaters' });
        }

        if (item.ty == 'sr') {
          errors.push({ message: 'Composition should not include any Star Shapes' });
        }

        if (item.ty == 'mm') {
          errors.push({ message: 'Composition should not include any Merge Paths' });
        }

        if (item.ty == 'gs') {
          errors.push({ message: 'Composition should not include any Gradient Strokes' });
        }

        if (shapes === true) {
          const itemErrors: IValidationError[] = this.checkItems(item.it, false);

          if (itemErrors.length !== 0) {
            errors.push({ message: 'Composition items should not have errors', details: itemErrors });
          }
        }
      });
    }

    return errors;
  }

}
