// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class RenderContext {
    constructor(canvas) {
        this.disposed = false;
        // The textures that sample between their mipmap levels.
        this.mipMappedTextures = new WeakSet();
        this.canvas = canvas;
    }
    /// The texture samples between its mipmap levels, so drawing into it makes the levels anew.
    /// Asking the texture for its filter would wait for the GPU process.
    markMipMapped(texture) {
        this.mipMappedTextures.add(texture);
    }
    isMipMapped(texture) {
        return this.mipMappedTextures.has(texture);
    }
    getGl() {
        return this.gl;
    }
    get2dGl() {
        return this.gl &&
            (this.gl instanceof CanvasRenderingContext2D ||
                this.gl.constructor?.name === 'CanvasRenderingContext2D')
            ? this.gl
            : null;
    }
    get2dOffscreen() {
        return this.gl instanceof OffscreenCanvasRenderingContext2D
            ? this.gl
            : null;
    }
    isDisposed() {
        return this.disposed;
    }
    createTextureWithColor(color) {
        return null;
    }
    createEmptySlide() {
        return null;
    }
    createTransparentTexture() {
        return null;
    }
}
class RenderContextGl extends RenderContext {
    constructor(canvas, attributes = {}) {
        super(canvas);
        this.gl = this.canvas.getContext('webgl2', {
            failIfMajorPerformanceCaveat: true,
            ...attributes,
        });
        if (!this.gl) {
            app.console.error('WebGL2 not supported');
            throw new Error('WebGL2 not supported');
        }
    }
    is2dGl() {
        return false;
    }
    clear() {
        this.disposed = true;
        this.gl = null;
    }
    loadTexture(image, isMipMapEnable = false, nearestFiltering = false) {
        if (this.isDisposed())
            return null;
        if (!image) {
            app.console.error('RenderContextGl.loadTexture: Invalid image provided');
            return null;
        }
        const gl = this.getGl();
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create texture');
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const filter = nearestFiltering ? gl.NEAREST : gl.LINEAR;
        if (isMipMapEnable) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            this.markMipMapped(texture);
        }
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        if (image instanceof HTMLImageElement)
            app.console.debug(`Texture loaded successfully`);
        return texture;
    }
    deleteTexture(texture) {
        if (this.isDisposed())
            return;
        const gl = this.getGl();
        gl.deleteTexture(texture);
    }
    deleteVertexArray(vao) {
        if (this.isDisposed())
            return;
        const gl = this.getGl();
        gl.deleteVertexArray(vao);
    }
    createTextureWithColor(color) {
        if (this.isDisposed())
            return null;
        const gl = this.getGl();
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create texture');
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const colorPixel = new Uint8Array(color);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorPixel);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    }
    createEmptySlide() {
        return this.createTextureWithColor([0, 0, 0, 255]);
    }
    createTransparentTexture() {
        return this.createTextureWithColor([0, 0, 0, 0]);
    }
    createVertexShader(source) {
        return this.createShader(this.getGl().VERTEX_SHADER, source);
    }
    createFragmentShader(source) {
        return this.createShader(this.getGl().FRAGMENT_SHADER, source);
    }
    createShader(type, source) {
        if (this.isDisposed())
            return null;
        const gl = this.getGl();
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error('Failed to create shader');
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Could not compile shader: ${info}`);
        }
        app.console.log('Shader compiled successfully:', type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT');
        return shader;
    }
    createProgram(vertexShader, fragmentShader) {
        if (this.isDisposed())
            return null;
        const gl = this.getGl();
        const program = gl.createProgram();
        if (!program) {
            throw new Error('Failed to create program');
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Could not link program: ${info}`);
        }
        app.console.log('Program linked successfully');
        return program;
    }
}
class RenderContext2d extends RenderContext {
    constructor(canvas) {
        super(canvas);
        this.gl = this.canvas.getContext('2d');
        if (!this.gl) {
            app.console.error('Canvas rendering not supported');
            throw new Error('Canvas rendering not supported');
        }
    }
    is2dGl() {
        return true;
    }
    clear() {
        this.disposed = true;
        this.gl = null;
    }
    loadTexture(image, isMipMapEnable = false, nearestFiltering = false) {
        return image;
    }
    createVertexShader(source) {
        return null;
    }
    createFragmentShader(source) {
        return null;
    }
    createShader(type, source) {
        return null;
    }
    deleteTexture(texture) {
        return;
    }
    deleteVertexArray(vao) {
        return;
    }
    createProgram(vertexShader, fragmentShader) {
        return null;
    }
}
