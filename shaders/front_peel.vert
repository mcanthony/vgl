#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif

varying vec3 color;

//uniform
attribute highp vec3 vertexPosition;
attribute mediump vec3 vertexNormal;
attribute mediump vec3 vertexColor;

uniform highp mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 normalMatrix;

varying highp vec4 varPosition;
varying mediump vec3 varNormal;
varying mediump vec3 iVertexColor;

void main()
{
	// Get the clipspace vertex position
	gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1);

    varPosition = modelViewMatrix * vec4(vertexPosition, 1.0);
    gl_Position = projectionMatrix * varPosition;
    varNormal = vec3(normalMatrix * vec4(vertexNormal, 0.0));
    iVertexColor = vertexColor;
}