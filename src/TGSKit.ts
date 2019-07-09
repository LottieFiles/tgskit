import * as pako from 'pako';

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
   * Validates that the Bodymovin JSON meets the requirements for
   * a Telegram Sticker (tgs).
   */
  public validate(): string[] {
    const errors: string[] = [];

    if (((this._data.op - this._data.ip) / this._data.fr) > 3.0) {
      errors.push('Longer than 3 seconds');
    }

    if (this._data.w != 512 || this._data.h != 512) {
      errors.push('Dimensions should be exactly 512pxx512px');
    }

    if (this._data.ddd != null && this._data.ddd != 0) {
      errors.push('Must not have 3D layers');
    }

    if ('markers' in this._data) {
      errors.push('Must not have markers');
    }

    if ('assets' in this._data && Array.isArray(this._data.assets)) {
      this._data.assets.forEach((asset: any) => {
        errors.concat(this.checkLayer(asset.layers));
      });
    }

    if ('layers' in this._data && Array.isArray(this._data.layers)) {
      this._data.layers.forEach((layer: any) => {
        errors.concat(this.checkLayer(layer));
      });
    } else {
      errors.push('Must have atleast 1 layer');
    }

    return errors;
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

    // GZip and return
    return pako.gzip(JSON.stringify(this._data));
  }

  /**
   * Generates and triggers a download of the TGS file in the browser.
   */
  public download(filename: string = 'data') {
    if (!document) {
      return;
    }

    const blob = new Blob([this.generate()], { type: 'application/gzip' });
    const url = URL.createObjectURL(blob)

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

            // @ts-ignore
            const data = String.fromCharCode.apply(null, new Uint8Array(xhr.response as ArrayBuffer));
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

  private checkLayer(layer: any): string[] {
    const errors: string[] = [];

    if (layer.ddd != null && layer.ddd != 0) {
      errors.push('Composition should not include any 3D Layers');
    }

    if (layer.sr != null && layer.sr != 1) {
      errors.push('Composition should not include any Time Stretching');
    }

    if (layer.tm != null) {
      errors.push('Composition should not include any Time Remapping');
    }

    if (layer.ty === 1) {
      errors.push('Composition should not include any Solids');
    }

    if (layer.ty === 2) {
      errors.push('Composition should not include any Images');
    }

    if (layer.ty === 5) {
      errors.push('Composition should not include any Texts');
    }

    if (layer.hasMask === true || layer.masksProperties != null) {
      errors.push('Composition should not include any Masks');
    }

    if (layer.tt != null) {
      errors.push('Composition should not include any Mattes');
    }

    if (layer.ao === 1) {
      errors.push('Composition should not include any Auto-Oriented Layers');
    }

    if (layer.ef != null) {
      errors.push('Composition should not include any Layer Effects');
    }

    errors.concat(this.checkItems(layer.shapes, true));

    return errors;
  }

  private checkItems(items: any, shapes: any): string[] {
    const errors: string[] = [];

    if (items != null) {
      items.forEach((item: any) => {
        if (item.ty == 'rp') {
          errors.push('Composition should not include any Repeaters');
        }

        if (item.ty == 'sr') {
          errors.push('Composition should not include any Star Shapes');
        }

        if (item.ty == 'mm') {
          errors.push('Composition should not include any Merge Paths');
        }

        if (item.ty == 'gs') {
          errors.push('Composition should not include any Gradient Strokes');
        }

        if (shapes === true) {
          errors.concat(this.checkItems(item.it, false));
        }
      });
    }

    return errors;
  }

}
