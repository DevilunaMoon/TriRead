// This comment required to work around preprocessor bugs

!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fzstd',f]):(typeof self!='undefined'?self:this).fzstd=f()}(function(){var _e={};"use strict";var r=ArrayBuffer,t=Uint8Array,e=Uint16Array,n=Int16Array,a=Uint32Array,s=Int32Array,i=function(r,e,n){if(t.prototype.slice)return t.prototype.slice.call(r,e,n);(null==e||e<0)&&(e=0),(null==n||n>r.length)&&(n=r.length);var a=new t(n-e);return a.set(r.subarray(e,n)),a},o=function(r,e,n,a){if(t.prototype.fill)return t.prototype.fill.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;++n)r[n]=e;return r},u=function(r,e,n,a){if(t.prototype.copyWithin)return t.prototype.copyWithin.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;)r[e++]=r[n++]};_e.ZstdErrorCode={InvalidData:0,WindowSizeTooLarge:1,InvalidBlockType:2,FSEAccuracyTooHigh:3,DistanceTooFarBack:4,UnexpectedEOF:5};var f=["invalid zstd data","window size too large (>2046MB)","invalid block type","FSE accuracy too high","match distance too far back","unexpected EOF"],h=function(r,t,e){var n=Error(t||f[r]);if(n.code=r,Error.captureStackTrace&&Error.captureStackTrace(n,h),!e)throw n;return n},l=function(r,t,e){for(var n=0,a=0;n<e;++n)a|=r[t++]<<(n<<3);return a},v=function(r,t){return(r[t]|r[t+1]<<8|r[t+2]<<16|r[t+3]<<24)>>>0},c=function(r,e){var n=r[0]|r[1]<<8|r[2]<<16;if(3126568==n&&253==r[3]){var a=r[4],i=a>>5&1,o=a>>2&1,u=3&a,f=a>>6;8&a&&h(0);var c=6-i,b=3==u?4:u,y=l(r,c,b),p=f?1<<f:i,w=l(r,c+=b,p)+(1==f&&256),g=w;if(!i){var d=1<<10+(r[5]>>3);g=d+(d>>3)*(7&r[5])}g>2145386496&&h(1);var m=new t((1==e?w||g:e?0:g)+12);return m[0]=1,m[4]=4,m[8]=8,{b:c+p,y:0,l:0,d:y,w:e&&1!=e?e:m.subarray(12),e:g,o:new s(m.buffer,0,3),u:w,c:o,m:Math.min(131072,g)}}if(25481893==(n>>4|r[3]<<20))return v(r,4)+8;h(0)},b=function(r){for(var t=0;1<<t<=r;++t);return t-1},y=function(a,s,i){var o=4+(s<<3),u=5+(15&a[s]);u>i&&h(3);for(var f=1<<u,l=f,v=-1,c=-1,y=-1,p=f,w=new r(512+(f<<2)),g=new n(w,0,256),d=new e(w,0,256),m=new e(w,512,f),z=512+(f<<1),E=new t(w,z,f),k=new t(w,z+f);v<255&&l>0;){var A=b(l+1),T=o>>3,x=(1<<A+1)-1,F=(a[T]|a[T+1]<<8|a[T+2]<<16)>>(7&o)&x,S=(1<<A)-1,B=x-l-1,I=F&S;if(I<B?(o+=A,F=I):(o+=A+1,F>S&&(F-=B)),g[++v]=--F,-1==F?(l+=F,E[--p]=v):l-=F,!F)do{var U=o>>3;c=(a[U]|a[U+1]<<8)>>(7&o)&3,o+=2,v+=c}while(3==c)}(v>255||l)&&h(0);for(var D=0,M=(f>>1)+(f>>3)+3,W=f-1,O=0;O<=v;++O){var j=g[O];if(j<1)d[O]=-j;else for(y=0;y<j;++y){E[D]=O;do{D=D+M&W}while(D>=p)}}for(D&&h(0),y=0;y<f;++y){var C=d[E[y]]++,H=k[y]=u-b(C);m[y]=(C<<H)-f}return[o+7>>3,{b:u,s:E,n:k,t:m}]},p=function(r,n){var a=0,s=-1,i=new t(292),u=r[n],f=i.subarray(0,256),l=i.subarray(256,268),v=new e(i.buffer,268);if(u<128){var c=y(r,n+1,6),p=c[1],w=c[0]<<3,g=r[n+=u];g||h(0);for(var d=0,m=0,z=p.b,E=z,k=(++n<<3)-8+b(g);!((k-=z)<w);){var A=k>>3;if(f[++s]=p.s[d+=(r[A]|r[A+1]<<8)>>(7&k)&(1<<z)-1],(k-=E)<w)break;f[++s]=p.s[m+=(r[A=k>>3]|r[A+1]<<8)>>(7&k)&(1<<E)-1],z=p.n[d],d=p.t[d],E=p.n[m],m=p.t[m]}++s>255&&h(0)}else{for(s=u-127;a<s;a+=2){var T=r[++n];f[a]=T>>4,f[a+1]=15&T}++n}var x=0;for(a=0;a<s;++a)(I=f[a])>11&&h(0),x+=I&&1<<I-1;var F=b(x)+1,S=1<<F,B=S-x;for(B&B-1&&h(0),f[s++]=b(B)+1,a=0;a<s;++a){var I;++l[f[a]=(I=f[a])&&F+1-I]}var U=new t(S<<1),D=U.subarray(0,S),M=U.subarray(S);for(v[F]=0,a=F;a>0;--a){var W=v[a];o(M,a,W,v[a-1]=W+l[a]*(1<<F-a))}for(v[0]!=S&&h(0),a=0;a<s;++a){var O=f[a];if(O){var j=v[O];o(D,a,j,v[O]=j+(1<<F-O))}}return[n,{n:M,b:F,s:D}]},w=y(new t([81,16,99,140,49,198,24,99,12,33,196,24,99,102,102,134,70,146,4]),0,6)[1],g=y(new t([33,20,196,24,99,140,33,132,16,66,8,33,132,16,66,8,33,68,68,68,68,68,68,68,68,36,9]),0,6)[1],d=y(new t([32,132,16,66,102,70,68,68,68,68,36,73,2]),0,5)[1],m=function(r,t){for(var e=r.length,n=new s(e),a=0;a<e;++a)n[a]=t,t+=1<<r[a];return n},z=new t(new s([0,0,0,0,16843009,50528770,134678020,202050057,269422093]).buffer,0,36),E=m(z,0),k=new t(new s([0,0,0,0,0,0,0,0,16843009,50528770,117769220,185207048,252579084,16]).buffer,0,53),A=m(k,3),T=function(r,t,e){var n=r.length,a=t.length,s=r[n-1],i=(1<<e.b)-1,o=-e.b;s||h(0);for(var u=0,f=e.b,l=(n<<3)-8+b(s)-f,v=-1;l>o&&v<a;){var c=l>>3;t[++v]=e.s[u=(u<<f|(r[c]|r[c+1]<<8|r[c+2]<<16)>>(7&l))&i],l-=f=e.n[u]}l==o&&v+1==a||h(0)},x=function(r,t,e){var n=6,a=t.length+3>>2,s=a<<1,i=a+s;T(r.subarray(n,n+=r[0]|r[1]<<8),t.subarray(0,a),e),T(r.subarray(n,n+=r[2]|r[3]<<8),t.subarray(a,s),e),T(r.subarray(n,n+=r[4]|r[5]<<8),t.subarray(s,i),e),T(r.subarray(n),t.subarray(i),e)},F=function(r,n,a){var s,u=n.b,f=r[u],l=f>>1&3;n.l=1&f;var v=f>>3|r[u+1]<<5|r[u+2]<<13,c=(u+=3)+v;if(1==l){if(u>=r.length)return;return n.b=u+1,a?(o(a,r[u],n.y,n.y+=v),a):o(new t(v),r[u])}if(!(c>r.length)){if(0==l)return n.b=c,a?(a.set(r.subarray(u,c),n.y),n.y+=v,a):i(r,u,c);if(2==l){var m=r[u],F=3&m,S=m>>2&3,B=m>>4,I=0,U=0;F<2?1&S?B|=r[++u]<<4|(2&S&&r[++u]<<12):B=m>>3:(U=S,S<2?(B|=(63&r[++u])<<4,I=r[u]>>6|r[++u]<<2):2==S?(B|=r[++u]<<4|(3&r[++u])<<12,I=r[u]>>2|r[++u]<<6):(B|=r[++u]<<4|(63&r[++u])<<12,I=r[u]>>6|r[++u]<<2|r[++u]<<10)),++u;var D=a?a.subarray(n.y,n.y+n.m):new t(n.m),M=D.length-B;if(0==F)D.set(r.subarray(u,u+=B),M);else if(1==F)o(D,r[u++],M);else{var W=n.h;if(2==F){var O=p(r,u);I+=u-(u=O[0]),n.h=W=O[1]}else W||h(0);(U?x:T)(r.subarray(u,u+=I),D.subarray(M),W)}var j=r[u++];if(j){255==j?j=32512+(r[u++]|r[u++]<<8):j>127&&(j=j-128<<8|r[u++]);var C=r[u++];3&C&&h(0);for(var H=[g,d,w],L=2;L>-1;--L){var Z=C>>2+(L<<1)&3;if(1==Z){var q=new t([0,0,r[u++]]);H[L]={s:q.subarray(2,3),n:q.subarray(0,1),t:new e(q.buffer,0,1),b:0}}else 2==Z?(u=(s=y(r,u,9-(1&L)))[0],H[L]=s[1]):3==Z&&(n.t||h(0),H[L]=n.t[L])}var G=n.t=H,J=G[0],K=G[1],N=G[2],P=r[c-1];P||h(0);var Q=(c<<3)-8+b(P)-N.b,R=Q>>3,V=0,X=(r[R]|r[R+1]<<8)>>(7&Q)&(1<<N.b)-1,Y=(r[R=(Q-=K.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<K.b)-1,$=(r[R=(Q-=J.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<J.b)-1;for(++j;--j;){var _=N.s[X],rr=N.n[X],tr=J.s[$],er=J.n[$],nr=K.s[Y],ar=K.n[Y],sr=1<<nr,ir=sr+((r[R=(Q-=nr)>>3]|r[R+1]<<8|r[R+2]<<16|r[R+3]<<24)>>>(7&Q)&sr-1);R=(Q-=k[tr])>>3;var or=A[tr]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<k[tr])-1);R=(Q-=z[_])>>3;var ur=E[_]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<z[_])-1);if(R=(Q-=rr)>>3,X=N.t[X]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<rr)-1),R=(Q-=er)>>3,$=J.t[$]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<er)-1),R=(Q-=ar)>>3,Y=K.t[Y]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<ar)-1),ir>3)n.o[2]=n.o[1],n.o[1]=n.o[0],n.o[0]=ir-=3;else{var fr=ir-(0!=ur);fr?(ir=3==fr?n.o[0]-1:n.o[fr],fr>1&&(n.o[2]=n.o[1]),n.o[1]=n.o[0],n.o[0]=ir):ir=n.o[0]}for(L=0;L<ur;++L)D[V+L]=D[M+L];M+=ur;var hr=(V+=ur)-ir;if(hr<0){var lr=-hr,vr=n.e+hr;for(lr>or&&(lr=or),L=0;L<lr;++L)D[V+L]=n.w[vr+L];V+=lr,or-=lr,hr=0}for(L=0;L<or;++L)D[V+L]=D[hr+L];V+=or}if(V!=M)for(;M<D.length;)D[V++]=D[M++];else V=D.length;a?n.y+=V:D=i(D,0,V)}else if(a){if(n.y+=B,M)for(L=0;L<B;++L)D[L]=D[M+L]}else M&&(D=i(D,M));return n.b=c,D}h(2)}},S=function(r,e){if(1==r.length)return r[0];for(var n=new t(e),a=0,s=0;a<r.length;++a){var i=r[a];n.set(i,s),s+=i.length}return n};function B(r,t){for(var e=0,n=[],a=+!t,s=0;r.length;){var i=c(r,a||t);if("object"==typeof i){for(a?(t=null,i.w.length==i.u&&(n.push(t=i.w),s+=i.u)):(n.push(t),i.e=0);!i.l;){var o=F(r,i,t);o||h(5),t?i.e=i.y:(n.push(o),s+=o.length,u(i.w,0,o.length),i.w.set(o,i.w.length-o.length))}e=i.b+4*i.c}else e=i;r=r.subarray(e)}return S(n,s)}_e.decompress=B;var I=function(){function r(r){this.ondata=r,this.c=[],this.l=0,this.z=0}return r.prototype.push=function(r,t){if("number"==typeof this.s){var e=Math.min(r.length,this.s);r=r.subarray(e),this.s-=e}var n=r.length+this.l;if(!this.s){if(t){if(!n)return;n<5&&h(5)}else if(n<18)return this.c.push(r),void(this.l=n);if(this.l&&(this.c.push(r),r=S(this.c,n),this.c=[],this.l=0),"number"==typeof(this.s=c(r)))return this.push(r,t)}if("number"!=typeof this.s){if(n<(this.z||4))return t&&h(5),this.c.push(r),void(this.l=n);if(this.l&&(this.c.push(r),r=S(this.c,n),this.c=[],this.l=0),!this.z&&n<(this.z=2&r[this.s.b]?5:4+(r[this.s.b]>>3|r[this.s.b+1]<<5|r[this.s.b+2]<<13)))return t&&h(5),this.c.push(r),void(this.l=n);for(this.z=0;;){var a=F(r,this.s);if(!a){t&&h(5);var s=r.subarray(this.s.b);return this.s.b=0,this.c.push(s),void(this.l+=s.length)}if(this.ondata(a,!1),u(this.s.w,0,a.length),this.s.w.set(a,this.s.w.length-a.length),this.s.l){var i=r.subarray(this.s.b);return this.s=4*this.s.c,void this.push(i,t)}}}},r}();_e.Decompress=I;return _e})

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global L */
var cool;
(function (cool) {
    class RawDelta {
        constructor(delta, id, isKeyframe) {
            this._delta = delta;
            this._id = id;
            this._isKeyframe = isKeyframe;
        }
        get length() {
            return this.delta.length;
        }
        get delta() {
            return this._delta;
        }
        get id() {
            return this._id;
        }
        get isKeyframe() {
            return this._isKeyframe;
        }
    }
    cool.RawDelta = RawDelta;
    class CanvasTileUtils {
        // A DataView reads in an explicit byte order, a Uint32Array writes in the
        // platform's, so pixels are read in the platform's order to copy their bytes as-is.
        static { this.littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1; }
        // Cairo (and therefore the server's tile buffers) uses premultiplied alpha,
        // but ImageData / 2D-canvas compositing expects straight alpha. We convert
        // the changed pixels back as deltas are applied. A lookup table keyed by
        // (alpha << 8) + channelValue avoids a per-channel divide in the hot path.
        static { this.unpremultiplyTable = null; }
        static getUnpremultiplyTable() {
            if (this.unpremultiplyTable)
                return this.unpremultiplyTable;
            const table = new Uint8Array(256 * 256);
            // The alpha === 0 row stays zero: fully transparent -> zero RGB.
            for (let a = 1; a < 256; ++a) {
                const base = a << 8;
                for (let v = 0; v < 256; ++v)
                    table[base + v] = Math.min(255, Math.ceil((v * 255) / a));
            }
            this.unpremultiplyTable = table;
            return table;
        }
        // Convert premultiplied-alpha RGBA to straight alpha, in place.
        // byteOffset/byteLength delimit the region to touch.
        static unpremultiply(data, byteLength, byteOffset = 0) {
            const table = this.getUnpremultiplyTable();
            for (let i = byteOffset; i < byteOffset + byteLength; i += 4) {
                const alpha = data[i + 3];
                if (alpha === 255)
                    continue;
                const base = alpha << 8;
                data[i] = table[base + data[i]];
                data[i + 1] = table[base + data[i + 1]];
                data[i + 2] = table[base + data[i + 2]];
            }
        }
        // output.byteOffset + outputOffset must be a multiple of 4, and output must
        // hold width * height * 4 bytes from outputOffset. Decoding stops at the
        // first row that does not fit in data, and leaves the rows below as they were.
        static unrle(data, width, height, output, outputOffset = 0) {
            // Pixels are copied as 32-bit words.
            const output32 = new Uint32Array(output.buffer, output.byteOffset + outputOffset, width * height);
            const input = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const littleEndian = this.littleEndian;
            let offset = 0;
            const rleMaskSizeBytes = 256 / 8;
            for (let y = 0; y < height; ++y) {
                if (offset + 2 + rleMaskSizeBytes > data.length)
                    return data.length;
                const rleSize = data[offset] + data[offset + 1] * 256;
                if (offset + 2 + rleMaskSizeBytes + rleSize * 4 > data.length)
                    return data.length;
                offset += 2;
                const rleMask = offset;
                offset += rleMaskSizeBytes;
                if (rleSize > 0)
                    this.unpremultiply(data, rleSize * 4, offset);
                let lastPixel = 0;
                let lastMask = 0;
                let bitToCheck = 256;
                let rleMaskOffset = rleMask;
                let pixOffset = y * width;
                let pixSrc = offset;
                for (let x = 0; x < width; ++x) {
                    if (bitToCheck > 128) {
                        bitToCheck = 1;
                        lastMask = data[rleMaskOffset++];
                    }
                    if (!(lastMask & bitToCheck)) {
                        lastPixel = input.getUint32(pixSrc, littleEndian);
                        pixSrc += 4;
                    }
                    bitToCheck = bitToCheck << 1;
                    output32[pixOffset++] = lastPixel;
                }
                offset += rleSize * 4;
            }
            return offset;
        }
        static updateImageFromDeltas(imageData, deltas, keyframeDeltaSize, tileSize, debug = false) {
            let nDelta = 0;
            let offset = keyframeDeltaSize;
            while (offset < deltas.length) {
                if (debug)
                    console.debug('Next delta at ' + offset + ' length ' + (deltas.length - offset));
                const delta = !offset ? deltas : deltas.subarray(offset);
                // Debugging paranoia: if we get this wrong bad things happen.
                const susDeltaSize = tileSize * tileSize * 4;
                if (debug && delta.length >= susDeltaSize) {
                    console.warn('Unusual delta possibly mis-tagged, suspicious size vs. type ' +
                        delta.length +
                        ' vs. ' +
                        susDeltaSize);
                }
                // copy old data to work from:
                const oldData = new Uint8Array(imageData);
                if (debug)
                    console.debug('Applying delta chunk ' +
                        nDelta++ +
                        ' of total size ' +
                        delta.length +
                        ' at stream offset ' +
                        offset);
                // + ' hex: ' + hex2string(delta, delta.length));
                const len = this.applyDeltaChunk(imageData, delta, oldData, tileSize, tileSize, debug);
                if (debug)
                    console.debug('Applied delta chunk of size ' + len);
                offset += len;
            }
        }
        static applyDeltaChunk(imgData, delta, oldData, width, height, debug = false) {
            const pixSize = width * height * 4;
            let offset = 0;
            // Green-tinge the old-Data ...
            if (0) {
                for (let i = 0; i < pixSize; ++i)
                    oldData[i * 4 + 1] = 128;
            }
            // wipe to grey.
            if (0) {
                for (let i = 0; i < pixSize * 4; ++i)
                    imgData[i] = 128;
            }
            // Apply delta.
            let i = 0;
            for (let stop = false; i < delta.length && !stop;) {
                switch (delta[i]) {
                    case 99: {
                        // 'c': // copy row
                        const count = delta[i + 1];
                        const srcRow = delta[i + 2];
                        const destRow = delta[i + 3];
                        if (debug)
                            console.debug('[' +
                                i +
                                ']: copy ' +
                                count +
                                ' row(s) ' +
                                srcRow +
                                ' to ' +
                                destRow);
                        i += 4;
                        for (let cnt = 0; cnt < count; ++cnt) {
                            const src = (srcRow + cnt) * width * 4;
                            const dest = (destRow + cnt) * width * 4;
                            for (let j = 0; j < width * 4; ++j) {
                                imgData[dest + j] = oldData[src + j];
                            }
                        }
                        break;
                    }
                    case 100: {
                        // 'd': // new run
                        const destRow = delta[i + 1];
                        const destCol = delta[i + 2];
                        let span = delta[i + 3];
                        offset = destRow * width * 4 + destCol * 4;
                        if (debug)
                            console.debug('[' +
                                i +
                                ']: apply new span of size ' +
                                span +
                                ' at pos ' +
                                destCol +
                                ', ' +
                                destRow +
                                ' into delta at byte: ' +
                                offset);
                        i += 4;
                        span *= 4;
                        this.unpremultiply(delta, span, i);
                        for (let j = 0; j < span; ++j)
                            imgData[offset++] = delta[i + j];
                        i += span;
                        // imgData.data[offset - 2] = 256; // debug - blue terminator
                        break;
                    }
                    case 116: {
                        // 't': // terminate delta new one next
                        stop = true;
                        i++;
                        break;
                    }
                    default: {
                        console.error('[' + i + ']: ERROR: Unknown delta code ' + delta[i]);
                        i = delta.length;
                        break;
                    }
                }
            }
            return i;
        }
    }
    cool.CanvasTileUtils = CanvasTileUtils;
})(cool || (cool = {})); // namespace cool

/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable no-inner-declarations */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* global Uint8Array cool */

if ('undefined' === typeof window) {
	self.L = {};

	// CanvasTileUtils.js is concatenated ahead of this file, so cool.CanvasTileUtils is already
	// in the worker's global scope.

	let tileImageCache = new Map(); // Map<string, Uint8Array>

	addEventListener('message', onMessage);

	console.info('TaskWorker initialised');

	// Drop the images of the tiles that the main thread no longer caches.
	function syncImageCache(cachedTiles) {
		for (const key of Array.from(tileImageCache.keys())) {
			if (!cachedTiles.has(key)) tileImageCache.delete(key);
		}
	}

	function onMessage(e) {
		switch (e.data.message) {
			case 'trimImageCache':
				syncImageCache(e.data.cachedTiles);
				break;

			case 'endTransaction': {
				syncImageCache(e.data.cachedTiles);

				const bitmaps = []; // Promise<ImageBitmap>[]
				const tilesWithBitmaps = [];

				const tileByteSize = e.data.tileSize * e.data.tileSize * 4;
				for (const tile of e.data.deltas) {
					const deltas = self.fzstd.decompress(tile.rawDelta);

					// Decompress the keyframe buffer
					let keyframeDeltaSize = 0;
					let imageData = null;
					if (tile.isKeyframe) {
						imageData = new Uint8Array(tileByteSize);
						keyframeDeltaSize = cool.CanvasTileUtils.unrle(
							deltas,
							e.data.tileSize,
							e.data.tileSize,
							imageData,
						);
					} else imageData = tileImageCache.get(tile.key);

					// The main thread has no use for the concatenated rawDelta, delete it here
					// instead of passing it back.
					delete tile.rawDelta;

					if (imageData === null) {
						console.warn('Delta update received on tile with no cached image');
						continue;
					}

					cool.CanvasTileUtils.updateImageFromDeltas(
						imageData,
						deltas,
						keyframeDeltaSize,
						e.data.tileSize,
					);
					tileImageCache.set(tile.key, imageData);

					const clampedData = new Uint8ClampedArray(
						imageData.buffer,
						imageData.byteOffset,
						imageData.byteLength,
					);
					const image = new ImageData(
						clampedData,
						e.data.tileSize,
						e.data.tileSize,
					);
					bitmaps.push(
						createImageBitmap(image, {
							premultiplyAlpha: 'none',
						}),
					);
					tilesWithBitmaps.push(tile);
				}

				Promise.all(bitmaps).then((bitmaps) => {
					for (const bitmap of bitmaps) {
						const tile = tilesWithBitmaps.shift();
						tile.bitmap = bitmap;
					}
					postMessage(
						{
							message: e.data.message,
							deltas: e.data.deltas,
							tileSize: e.data.tileSize,
						},
						bitmaps,
					);
				});
				break;
			}

			case 'decompressImageData': {
				const img = new Uint8ClampedArray(
					self.fzstd.decompress(e.data.rawData),
				);
				createImageBitmap(new ImageData(img, e.data.width, e.data.height), {
					premultiplyAlpha: 'none',
				}).then((bitmap) => {
					postMessage(
						{
							message: 'decompressedImageData',
							id: e.data.id,
							bitmap: bitmap,
						},
						[bitmap],
					);
				});
				break;
			}

			default:
				console.error('Unrecognised worker message');
		}
	}
}

