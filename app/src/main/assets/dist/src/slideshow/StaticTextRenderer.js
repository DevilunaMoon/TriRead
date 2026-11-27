// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class StaticTextRenderer extends TextureAnimationBase {
    constructor(canvasContext) {
        super(canvasContext);
    }
    display(displayText) {
        if (this.context.isDisposed())
            return;
        this.textTexture = this.createTextTexture(displayText);
        this.prepareTransition();
        requestAnimationFrame(this.animate.bind(this));
    }
    animate() {
        requestAnimationFrame(this.render.bind(this));
    }
    createTextTexture(displayText) {
        const textCanvas = this.create2DCanvasWithText(displayText);
        return this.load2dCanvasToGlCanvas(textCanvas);
    }
    // Create an off-screen 2D canvas with text centered
    create2DCanvasWithText(displayText) {
        if (this.context.isDisposed())
            return null;
        const canvas = document.createElement('canvas');
        canvas.width = this.context.canvas.width;
        canvas.height = this.context.canvas.height;
        const ctx = canvas.getContext('2d');
        // Set background color
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Set text attributes
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);
        return canvas;
    }
    load2dCanvasToGlCanvas(canvas) {
        if (this.context.isDisposed())
            return null;
        const texture = this.gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create texture');
        }
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    }
    render() {
        this.drawTextureOverCanvas(this.textTexture, 'u_texture');
    }
    getFragmentShader() {
        return `#version 300 es
			precision highp float;
			in vec2 v_texCoord;
			uniform sampler2D u_texture;
			out vec4 outColor;

			void main() {
				outColor = texture(u_texture, v_texCoord);
			}`;
    }
}
SlideShow.StaticTextRenderer = StaticTextRenderer;
