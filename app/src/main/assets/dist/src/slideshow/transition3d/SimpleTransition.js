/* -*- js-indent-level: 8 -*- */
class SimpleTransition extends SlideShow.Transition3d {
    constructor(transitionParameters) {
        super(transitionParameters);
        this.leavingPrimitives = [];
        this.enteringPrimitives = [];
        this.allOperations = [];
        this.textures = [];
        this.leavingPrimitives = transitionParameters.leavingPrimitives;
        this.enteringPrimitives = transitionParameters.enteringPrimitives;
        this.allOperations = transitionParameters.allOperations;
        this.textures = [transitionParameters.current, transitionParameters.next];
        this.initWebglFlags();
        this.prepareTransition();
    }
    initWebglFlags() {
        if (this.context.isDisposed())
            return;
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.CULL_FACE);
        // Enable alpha blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }
    initBuffers() {
        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);
        this.buffer = this.gl.createBuffer();
        if (!this.buffer) {
            throw new Error('Failed to create buffer');
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        // prettier-ignore
        const initialPositions = new Float32Array([
            -1, -1, 0, 0, 1,
            1, -1, 0, 1, 1,
            -1, 1, 0, 0, 0,
            1, 1, 0, 1, 0,
        ]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, initialPositions, this.gl.STATIC_DRAW);
        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        const normalLocation = this.gl.getAttribLocation(this.program, 'a_normal');
        const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        if (positionLocation !== -1) {
            this.gl.enableVertexAttribArray(positionLocation);
            this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 8 * 4, 0);
        }
        if (normalLocation !== -1) {
            this.gl.enableVertexAttribArray(normalLocation);
            this.gl.vertexAttribPointer(normalLocation, 3, this.gl.FLOAT, false, 8 * 4, 3 * 4);
        }
        if (texCoordLocation !== -1) {
            this.gl.enableVertexAttribArray(texCoordLocation);
            this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 8 * 4, 6 * 4);
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.bindVertexArray(null);
        console.debug('Simple Transition buffer initialized.');
    }
    applyAllOperation(t) {
        let matrix = mat4.create();
        for (const operation of this.allOperations) {
            matrix = operation.interpolate(matrix, t, 1.0, 1.0);
        }
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, 'u_operationsTransformMatrix'), false, matrix);
    }
    applyLeavingOperations(t, operations) {
        let matrix = mat4.create();
        for (const operation of operations) {
            matrix = operation.interpolate(matrix, t, 1.0, 1.0);
        }
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, 'u_primitiveTransformMatrix'), false, matrix);
    }
    applyEnteringOperations(t, operations) {
        let matrix = mat4.create();
        for (const operation of operations) {
            matrix = operation.interpolate(matrix, t, 1.0, 1.0);
        }
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, 'u_primitiveTransformMatrix'), false, matrix);
    }
    displayPrimitive(t, textureType, textureNum, texturePrimitive, textureName) {
        this.gl.activeTexture(textureType);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[textureNum]);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, textureName), 0);
        for (const primitive of texturePrimitive) {
            this.setBufferData(primitive.vertices);
            this.applyLeavingOperations(t, primitive.operations);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, primitive.vertices.length);
        }
    }
    displaySlides_(t) {
        this.applyAllOperation(t);
        this.displayPrimitive(t, this.gl.TEXTURE0, 0, this.leavingPrimitives, 'slideTexture');
        this.displayPrimitive(t, this.gl.TEXTURE0, 1, this.enteringPrimitives, 'slideTexture');
    }
    render(nT) {
        if (this.context.isDisposed())
            return;
        this.gl.viewport(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.program);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'time'), nT);
        this.gl.bindVertexArray(this.vao);
        this.displaySlides_(nT);
        this.gl.bindVertexArray(null);
        app.map.fire('newslideshowframe', {
            frame: this.gl.canvas,
        });
    }
    setBufferData(vertices) {
        const positionData = [];
        for (const vertex of vertices) {
            positionData.push(...vertex.position, ...vertex.normal, ...vertex.texCoord);
        }
        const positions = new Float32Array(positionData);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    }
}
SlideShow.SimpleTransition = SimpleTransition;
