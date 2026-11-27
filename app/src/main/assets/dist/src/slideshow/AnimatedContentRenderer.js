/* -*- js-indent-level: 8 -*- */
class AnimatedContentRenderInfo {
    constructor() {
        this.texture = null;
        this.vao = null;
        this.mirror = 0;
    }
    getTexture() {
        return this.texture;
    }
    replaceTexture(context, newtexture) {
        if (this.texture)
            context.deleteTexture(this.texture);
        this.texture = newtexture;
    }
    getVao() {
        return this.vao;
    }
    replaceVao(context, newVao) {
        if (this.vao)
            context.deleteVertexArray(this.vao);
        this.vao = newVao;
    }
    play() {
        // Nothing to start.
    }
    pause() {
        // Nothing to pause.
    }
    stop() {
        this.pause();
    }
    /// Play from the given second. Content without a timeline just plays.
    playFrom(_seconds) {
        this.play();
    }
    handleClick() {
        // Content ignores clicks.
    }
    deleteResources(context) {
        this.replaceTexture(context, null);
        this.replaceVao(context, null);
    }
}
class AnimatedContentRenderer {
    constructor(sId, context, slideRenderer) {
        this.info = null;
        this.sId = sId;
        this._context = context;
        this._slideRenderer = slideRenderer;
    }
    isDisposed() {
        return this._context && this._context.isDisposed();
    }
    getDocumentPositions(x, y, width, height, docWidth, docHeight) {
        const xMin = x / docWidth;
        const xMax = (x + width) / docWidth;
        const yMin = y / docHeight;
        const yMax = (y + height) / docHeight;
        return [xMin, xMax, yMin, yMax];
    }
    load() {
        if (this.info)
            this.info.load();
    }
    play() {
        if (this.info)
            this.info.play();
    }
    pause() {
        if (this.info)
            this.info.pause();
    }
    stop() {
        if (this.info)
            this.info.stop();
    }
    playFrom(seconds) {
        if (this.info)
            this.info.playFrom(seconds);
    }
    handleClick() {
        if (this.info)
            this.info.handleClick();
    }
    deleteResources() {
        if (this.info)
            this.info.deleteResources(this._context);
    }
    /// The frame shown now, null while there is none.
    currentFrame() {
        return null;
    }
}
class AnimatedContentRenderer2d extends AnimatedContentRenderer {
    // Apply the shape's draw state to the canvas as the shape itself is drawn: opacity,
    // transform, and the part a clip shows. The state is in slide units, the content in pixels.
    static applyLook(context, look, width, height) {
        const state = look.state;
        if (state.alpha !== undefined)
            context.globalAlpha = state.alpha;
        const scaleX = width / look.slideWidth;
        const scaleY = height / look.slideHeight;
        context.scale(scaleX, scaleY);
        const matrix = cool.Matrix2D.fromArray(state.transform);
        if (matrix)
            matrix.applyTo(context);
        if (state.clip)
            VectorManager.clipTo(context, state.clip);
        context.scale(1 / scaleX, 1 / scaleY);
    }
    render(look) {
        if (this.isDisposed())
            return;
        if (!this.info)
            return;
        if (look?.state.hidden)
            return;
        // The content is drawn into the slide layer canvas, which is an OffscreenCanvas.
        const ctx = this._context.get2dGl() ?? this._context.get2dOffscreen();
        if (!ctx) {
            app.console.error('Canvas 2D context not available');
            return;
        }
        const drawable = this.getDrawable();
        if (!drawable)
            return;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const pos2d = this.info.pos2d;
        const left = pos2d[0] * width;
        const top = pos2d[2] * height;
        const boxWidth = pos2d[1] * width - left;
        const boxHeight = pos2d[3] * height - top;
        const mirror = this.info.mirror;
        // Drawing about the centre keeps the flipped frame on the same area.
        ctx.save();
        if (look)
            AnimatedContentRenderer2d.applyLook(ctx, look, width, height);
        ctx.translate(left + boxWidth / 2, top + boxHeight / 2);
        ctx.scale(mirror & 1 ? -1 : 1, mirror & 2 ? -1 : 1);
        ctx.drawImage(drawable, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
        ctx.restore();
    }
}
// The WebGL backend uploads whichever image getDrawable returns into a texture
// and draws it on a quad. Each renderer owns its own program, so when one
// renderer frees its resources it never destroys a program another renderer is
// still drawing with. The vertex and fragment shaders are the same for a video
// and an animated image, so every renderer builds its program from the same
// shader source.
class AnimatedContentRendererGl extends AnimatedContentRenderer {
    constructor() {
        super(...arguments);
        this._program = null;
    }
    static getVertexShader() {
        return `#version 300 es
				in vec4 a_position;
				in vec2 a_texCoord;
				uniform mat3 u_transform;
				out vec2 v_texCoord;

				void main() {
					vec3 at = u_transform * vec3(a_position.xy, 1.0);
					gl_Position = vec4(at.xy, a_position.z, 1.0);
					v_texCoord = a_texCoord;
				}
				`;
    }
    static getFragmentShader() {
        return `#version 300 es
				precision mediump float;

				uniform sampler2D slideTexture;
				uniform float u_alpha;

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					outColor = texture(slideTexture, v_texCoord) * u_alpha;
				}
				`;
    }
    ensureProgram() {
        if (this._program)
            return;
        if (this._context.is2dGl() || this._context.isDisposed())
            return;
        const vertexShader = this._context.createVertexShader(AnimatedContentRendererGl.getVertexShader());
        const fragmentShader = this._context.createFragmentShader(AnimatedContentRendererGl.getFragmentShader());
        this._program = this._context.createProgram(vertexShader, fragmentShader);
    }
    deleteProgram() {
        if (!this._program)
            return;
        if (!this._context.is2dGl() && !this._context.isDisposed())
            this._context.getGl().deleteProgram(this._program);
        this._program = null;
    }
    deleteResources() {
        super.deleteResources();
        this.deleteProgram();
    }
    initTexture() {
        const gl = this._context.getGl();
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.placeholderPixel());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        return texture;
    }
    // jscpd:ignore-start
    setupPositions(xMin, xMax, yMin, yMax, mirror = 0) {
        if (this.isDisposed())
            return null;
        if (this._context.is2dGl())
            return null;
        const gl = this._context.getGl();
        // A flip swaps which edge of the image lands on which edge of the quad.
        const [texLeft, texRight] = mirror & 1 ? [1.0, 0.0] : [0.0, 1.0];
        const [texTop, texBottom] = mirror & 2 ? [0.0, 1.0] : [1.0, 0.0];
        // 5 numbers -> 3 x vertex X,Y,Z and 2x texture X,Y
        const positions = new Float32Array([
            //    vX    vY   vZ   tX       tY
            ...[xMin, -yMin, 0.0, texLeft, texTop],
            ...[xMax, -yMin, 0.0, texRight, texTop],
            ...[xMin, -yMax, 0.0, texLeft, texBottom],
            ...[xMax, -yMax, 0.0, texRight, texBottom],
        ]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        this.ensureProgram();
        const program = this._program;
        if (!program) {
            app.console.log('AnimatedContentRenderer: program is not valid');
            return null;
        }
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 5 * 4, 0);
        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
        return vao;
    }
    // jscpd:ignore-end
    setupRectangleInDocumentPositions(x, y, width, height, docWidth, docHeight, mirror = 0) {
        const positions = this.getDocumentPositions(x, y, width, height, docWidth, docHeight);
        return this.setupPositions(positions[0] * 2.0 - 1.0, positions[1] * 2.0 - 1.0, positions[2] * 2.0 - 1.0, positions[3] * 2.0 - 1.0, mirror);
    }
    updateTexture(texture, drawable) {
        const gl = this._context.getGl();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawable);
    }
    // The shape's state gives the frame its opacity and transform. The context has no stencil
    // buffer, so a clip leaves the frame whole.
    render(look) {
        if (this.isDisposed())
            return;
        if (!this.info)
            return;
        if (look?.state.hidden)
            return;
        if (!this._program) {
            app.console.log('AnimatedContentRenderer: program is not valid');
            return;
        }
        const drawable = this.getDrawable();
        if (!drawable)
            return;
        const gl = this._context.getGl();
        gl.useProgram(this._program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindVertexArray(this.info.getVao());
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        this.updateTexture(this.info.getTexture(), drawable);
        const alpha = look?.state.alpha ?? 1;
        gl.uniform1f(gl.getUniformLocation(this._program, 'u_alpha'), alpha);
        gl.uniformMatrix3fv(gl.getUniformLocation(this._program, 'u_transform'), false, AnimatedContentRendererGl.clipSpaceTransform(look));
        // The frame is multiplied by its opacity, so it blends premultiplied, like the layers of
        // the slide. The blend state stays set.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    // The slide unit transform of the state as a clip space matrix in GLSL column order. Clip
    // space runs from -1 to 1 across the slide, with y upwards.
    static clipSpaceTransform(look) {
        const transform = look?.state.transform;
        if (!look || !transform)
            return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
        const toClipSpace = new DOMMatrix()
            .translate(-1, 1)
            .scale(2 / look.slideWidth, -2 / look.slideHeight);
        const matrix = toClipSpace
            .multiply(new DOMMatrix(transform))
            .multiply(toClipSpace.inverse());
        return new Float32Array([
            matrix.a,
            matrix.b,
            0,
            matrix.c,
            matrix.d,
            0,
            matrix.e,
            matrix.f,
            1,
        ]);
    }
}
