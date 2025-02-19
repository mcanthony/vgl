//////////////////////////////////////////////////////////////////////////////
/**
 * @module vgl
 */

/*global vgl, mat4, unescape, Float32Array, Int8Array, Uint16Array*/
//////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////
//
// vbgModule.vtkReader class
// This contains code that unpack a json base64 encoded vtkdataset,
// such as those produced by ParaView's webGL exporter (where much
// of the code originated from) and convert it to VGL representation.
//
//////////////////////////////////////////////////////////////////////////////

vgl.vtkReader = function () {
  'use strict';

  if (!(this instanceof vgl.vtkReader)) {
    return new vgl.vtkReader();
  }

  var m_base64Chars =
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
     'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
     'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
     'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
     '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'],
  m_reverseBase64Chars = [],
  m_vtkRenderedList = {},
  m_vtkObjectCount = 0,
  m_vtkScene = null,
  m_node = null,
  END_OF_INPUT = -1,
  m_base64Str = '',
  m_base64Count = 0,
  m_pos = 0,
  m_viewer = null,
  i = 0;

  //initialize the array here if not already done.
  if (m_reverseBase64Chars.length === 0) {
    for (i = 0; i < m_base64Chars.length; i += 1) {
      m_reverseBase64Chars[m_base64Chars[i]] = i;
    }
  }



  ////////////////////////////////////////////////////////////////////////////
  /**
   * ntos
   *
   * @param n
   * @returns unescaped n
   */
  ////////////////////////////////////////////////////////////////////////////
  this.ntos = function (n) {
    var unN;

    unN = n.toString(16);
    if (unN.length === 1) {
      unN = '0' + unN;
    }
    unN = '%' + unN;

    return unescape(unN);
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * readReverseBase64
   *
   * @returns
   */
  ////////////////////////////////////////////////////////////////////////////
  this.readReverseBase64 = function () {
    var nextCharacter;

    if (!m_base64Str) {
      return END_OF_INPUT;
    }

    while (true) {
      if (m_base64Count >= m_base64Str.length) {
        return END_OF_INPUT;
      }
      nextCharacter = m_base64Str.charAt(m_base64Count);
      m_base64Count += 1;

      if (m_reverseBase64Chars[nextCharacter]) {
        return m_reverseBase64Chars[nextCharacter];
      }
      if (nextCharacter === 'A') {
        return 0;
      }
    }

    return END_OF_INPUT;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * decode64
   *
   * @param str
   * @returns result
   */
  ////////////////////////////////////////////////////////////////////////////
  this.decode64 = function (str) {
    var result = '',
        inBuffer = new Array(4),
        done = false;

    m_base64Str = str;
    m_base64Count = 0;

    while (!done &&
           (inBuffer[0] = this.readReverseBase64()) !== END_OF_INPUT &&
           (inBuffer[1] = this.readReverseBase64()) !== END_OF_INPUT) {
      inBuffer[2] = this.readReverseBase64();
      inBuffer[3] = this.readReverseBase64();
      /*jshint bitwise: false */
      result += this.ntos((((inBuffer[0] << 2) & 0xff) | inBuffer[1] >> 4));
      if (inBuffer[2] !== END_OF_INPUT) {
        result +=  this.ntos((((inBuffer[1] << 4) & 0xff) | inBuffer[2] >> 2));
        if (inBuffer[3] !== END_OF_INPUT) {
          result +=  this.ntos((((inBuffer[2] << 6) & 0xff) | inBuffer[3]));
        } else {
          done = true;
        }
      } else {
        done = true;
      }
      /*jshint bitwise: true */
    }

    return result;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * readNumber
   *
   * @param ss
   * @returns v
   */
  ////////////////////////////////////////////////////////////////////////////
  this.readNumber = function (ss) {
    //jshint plusplus: false, bitwise: false
    var v = ((ss[m_pos++]) +
             (ss[m_pos++] << 8) +
             (ss[m_pos++] << 16) +
             (ss[m_pos++] << 24));
    //jshint plusplus: true, bitwise: true
    return v;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * readF3Array
   *
   * @param numberOfPoints
   * @param ss
   * @returns points
   */
  ////////////////////////////////////////////////////////////////////////////
  this.readF3Array = function (numberOfPoints, ss) {
    var size = numberOfPoints * 4 * 3, test = new Int8Array(size),
        points = null, i;

    for (i = 0; i < size; i += 1) {
      test[i] = ss[m_pos];
      m_pos += 1;
    }

    points = new Float32Array(test.buffer);

    return points;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * readColorArray
   *
   * @param numberOfPoints
   * @param ss
   * @param vglcolors
   * @returns points
   */
  ////////////////////////////////////////////////////////////////////////////
  this.readColorArray = function (numberOfPoints, ss, vglcolors) {
    var i, idx = 0, tmp = new Array(numberOfPoints * 3);
    //jshint plusplus: false
    for (i = 0; i < numberOfPoints; i += 1) {
      tmp[idx++] = ss[m_pos++] / 255.0;
      tmp[idx++] = ss[m_pos++] / 255.0;
      tmp[idx++] = ss[m_pos++] / 255.0;
      m_pos++;
    }
    //jshint plusplus: true
    vglcolors.insert(tmp);
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parseObject
   *
   * @param buffer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parseObject = function (vtkObject) {
    var geom = new vgl.geometryData(), mapper = vgl.mapper(), ss = [],
        type = null, data = null, size, matrix = null, material = null,
        actor, colorMapData, shaderProg, opacityUniform, lookupTable,
        colorTable, windowSize, width, height, position;

    //dehexlify
    //data = this.decode64(vtkObject.data);
    data = atob(vtkObject.data);
    //jshint bitwise: false
    for (i = 0; i < data.length; i += 1) {
      ss[i] = data.charCodeAt(i) & 0xff;
    }
    //jshint bitwise: true

    //Determine the Object type
    m_pos = 0;
    size = this.readNumber(ss);
    type = String.fromCharCode(ss[m_pos]);
    m_pos += 1;
    geom.setName(type);

    // Lines
    if (type === 'L') {
      matrix = this.parseLineData(geom, ss);
      material = vgl.utils.createGeometryMaterial();
    // Mesh
    } else if (type === 'M') {
      matrix = this.parseMeshData(geom, ss);
      material = vgl.utils.createPhongMaterial();
    // Points
    } else if (type === 'P') {
      matrix = this.parsePointData(geom, ss);
      material = vgl.utils.createGeometryMaterial();
    // ColorMap
    } else if (type === 'C') {
      colorMapData = this.parseColorMapData(geom, ss, size);
      colorTable = [];

      for (i = 0; i < colorMapData.colors.length; i += 1) {
        colorTable.push(colorMapData.colors[i][1]);
        colorTable.push(colorMapData.colors[i][2]);
        colorTable.push(colorMapData.colors[i][3]);
        colorTable.push(colorMapData.colors[i][0] * 255);
      }

      lookupTable = new vgl.lookupTable();
      lookupTable.setColorTable(colorTable);

      windowSize = m_viewer.renderWindow().windowSize();
      width = colorMapData.size[0] * windowSize[0];
      height = colorMapData.size[1] * windowSize[1];

      position = [colorMapData.position[0] * windowSize[0],
                  (1 - colorMapData.position[1]) * windowSize[1], 0];
      position[1] = position[1] - height;

      // For now hardcode the height
      height = 30;

      return vgl.utils.createColorLegend(colorMapData.title,
          lookupTable, position, width, height, 3, 0);
    // Unknown
    } else {
      console.log('Ignoring unrecognized encoded data type ' + type);
    }

    mapper.setGeometryData(geom);

    //default opacity === solid. If were transparent, set it lower.
    if (vtkObject.hasTransparency) {
      shaderProg = material.shaderProgram();
      opacityUniform = shaderProg.uniform('opacity');
      console.log('opacity ', vtkObject.opacity);
      opacityUniform.set(vtkObject.opacity);
      material.setBinNumber(1000);
    }

    actor = vgl.actor();
    actor.setMapper(mapper);
    actor.setMaterial(material);
    actor.setMatrix(mat4.transpose(mat4.create(), matrix));

    return [actor];
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parseLineData
   *
   * @param geom, ss
   * @returns matrix
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parseLineData = function (geom, ss) {
    var vglpoints = null, vglcolors = null, vgllines = null,
        matrix = mat4.create(),
        numberOfIndex, numberOfPoints, points,
        temp, index, size, m, i,
        p = null, idx = 0;

    numberOfPoints = this.readNumber(ss);
    p = new Array(numberOfPoints * 3);

    //Getting Points
    vglpoints = new vgl.sourceDataP3fv();
    points = this.readF3Array(numberOfPoints, ss);

    //jshint plusplus: false
    for (i = 0; i < numberOfPoints; i += 1) {
      p[idx++] = points[i * 3/*+0*/];
      p[idx++] = points[i * 3 + 1];
      p[idx++] =  points[i * 3 + 2];
    }
    //jshint plusplus: true
    vglpoints.insert(p);
    geom.addSource(vglpoints);

    //Getting Colors
    vglcolors = new vgl.sourceDataC3fv();
    this.readColorArray(numberOfPoints, ss, vglcolors);
    geom.addSource(vglcolors);

    //Getting connectivity
    vgllines = new vgl.lines();
    geom.addPrimitive(vgllines);
    numberOfIndex = this.readNumber(ss);

    temp = new Int8Array(numberOfIndex * 2);
    for (i = 0; i < numberOfIndex * 2; i += 1) {
      temp[i] = ss[m_pos];
      m_pos += 1;
    }

    index = new Uint16Array(temp.buffer);
    vgllines.setIndices(index);
    vgllines.setPrimitiveType(vgl.GL.LINES);

    //Getting Matrix
    size = 16 * 4;
    temp = new Int8Array(size);
    for (i = 0; i < size; i += 1) {
      temp[i] = ss[m_pos];
      m_pos += 1;
    }

    m = new Float32Array(temp.buffer);
    mat4.copy(matrix, m);

    return matrix;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parseMeshData
   *
   * @param geom, ss
   * @returns matrix
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parseMeshData = function (geom, ss) {
    var vglpoints = null, vglcolors = null,
        normals = null, matrix = mat4.create(),
        vgltriangles = null, numberOfIndex, numberOfPoints,
        points, temp, index, size, m, i, tcoord,
        pn = null, idx = 0;

    numberOfPoints = this.readNumber(ss);
    pn = new Array(numberOfPoints * 6);
    //Getting Points
    vglpoints = new vgl.sourceDataP3N3f();
    points = this.readF3Array(numberOfPoints, ss);

    //Getting Normals
    normals = this.readF3Array(numberOfPoints, ss);
    //jshint plusplus: false
    for (i = 0; i < numberOfPoints; i += 1) {
      pn[idx++] = points[i * 3/*+0*/];
      pn[idx++] = points[i * 3 + 1];
      pn[idx++] = points[i * 3 + 2];
      pn[idx++] = normals[i * 3/*+0*/];
      pn[idx++] = normals[i * 3 + 1];
      pn[idx++] = normals[i * 3 + 2];
    }
    //jshint plusplus: true
    vglpoints.insert(pn);
    geom.addSource(vglpoints);

    //Getting Colors
    vglcolors = new vgl.sourceDataC3fv();
    this.readColorArray(numberOfPoints, ss, vglcolors);
    geom.addSource(vglcolors);

    //Getting connectivity
    temp = [];
    vgltriangles = new vgl.triangles();
    numberOfIndex = this.readNumber(ss);

    temp = new Int8Array(numberOfIndex * 2);
    for (i = 0; i < numberOfIndex * 2; i += 1) {
      temp[i] = ss[m_pos];
      m_pos += 1;
    }

    index = new Uint16Array(temp.buffer);
    vgltriangles.setIndices(index);
    geom.addPrimitive(vgltriangles);

    //Getting Matrix
    size = 16 * 4;
    temp = new Int8Array(size);
    for (i = 0; i < size; i += 1) {
      temp[i] = ss[m_pos];
      m_pos += 1;
    }

    m = new Float32Array(temp.buffer);
    mat4.copy(matrix, m);

    //Getting TCoord
    //TODO: renderer is not doing anything with this yet
    tcoord = null;

    return matrix;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parsePointData
   *
   * @param geom, ss
   * @returns matrix
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parsePointData = function (geom, ss) {
    var numberOfPoints, points, indices, temp, size,
        matrix = mat4.create(), vglpoints = null,
        vglcolors = null, vglVertexes = null, m,
        p = null, idx = 0;

    numberOfPoints = this.readNumber(ss);
    p = new Array(numberOfPoints * 3);

    //Getting Points and creating 1:1 connectivity
    vglpoints = new vgl.sourceDataP3fv();
    points = this.readF3Array(numberOfPoints, ss);

    indices = new Uint16Array(numberOfPoints);

    //jshint plusplus: false
    for (i = 0; i < numberOfPoints; i += 1) {
      indices[i] = i;
      p[idx++] = points[i * 3/*+0*/];
      p[idx++] = points[i * 3 + 1];
      p[idx++] = points[i * 3 + 2];
    }
    //jshint plusplus: true
    vglpoints.insert(p);
    geom.addSource(vglpoints);

    //Getting Colors
    vglcolors = new vgl.sourceDataC3fv();
    this.readColorArray(numberOfPoints, ss, vglcolors);
    geom.addSource(vglcolors);

    //Getting connectivity
    vglVertexes = new vgl.points();
    vglVertexes.setIndices(indices);
    geom.addPrimitive(vglVertexes);

    //Getting matrix
    size = 16 * 4;
    temp = new Int8Array(size);
    for (i = 0; i < size; i += 1) {
      temp[i] = ss[m_pos];
      m_pos += 1;
    }

    m = new Float32Array(temp.buffer);
    mat4.copy(matrix, m);

    return matrix;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parseColorMapData
   *
   * @param geom, ss
   * @returns matrix
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parseColorMapData = function (geom, ss, numColors) {

    var tmpArray, size, xrgb, i, c, obj = {};

    // Set number of colors
    obj.numOfColors = numColors;

    // Getting Position
    size = 8;
    tmpArray = new Int8Array(size);
    for (i = 0; i < size; i += 1) {
      tmpArray[i] = ss[m_pos];
      m_pos += 1;
    }
    obj.position = new Float32Array(tmpArray.buffer);

    // Getting Size
    size = 8;
    tmpArray = new Int8Array(size);
    for (i = 0; i < size; i += 1) {
      tmpArray[i] = ss[m_pos];
      m_pos += 1;
    }
    obj.size = new Float32Array(tmpArray.buffer);

    //Getting Colors
    obj.colors = [];
    //jshint plusplus: false
    for (c = 0; c < obj.numOfColors; c += 1) {
      tmpArray = new Int8Array(4);
      for (i = 0; i < 4; i += 1) {
        tmpArray[i] = ss[m_pos];
        m_pos += 1;
      }

      xrgb = [
        new Float32Array(tmpArray.buffer)[0],
        ss[m_pos++],
        ss[m_pos++],
        ss[m_pos++]
      ];
      obj.colors[c] = xrgb;
    }

    obj.orientation = ss[m_pos++];
    obj.numOfLabels = ss[m_pos++];
    obj.title = '';
    while (m_pos < ss.length) {
      obj.title += String.fromCharCode(ss[m_pos++]);
    }
    //jshint plusplus: true

    return obj;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * parseSceneMetadata
   *
   * @param data
   * @returns renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.parseSceneMetadata = function (renderer, layer) {

    var sceneRenderer = m_vtkScene.Renderers[layer],
        camera = renderer.camera(), bgc, localWidth, localHeight;

    localWidth = (sceneRenderer.size[0] - sceneRenderer.origin[0]) * m_node.width;
    localHeight = (sceneRenderer.size[1] - sceneRenderer.origin[1]) * m_node.height;
    renderer.resize(localWidth, localHeight);

    /// We are setting the center to the focal point because of
    /// a possible paraview web bug. The center of rotation isn't
    /// getting updated correctly on resetCamera.
    camera.setCenterOfRotation(
      [sceneRenderer.LookAt[1], sceneRenderer.LookAt[2],
       sceneRenderer.LookAt[3]]);
    camera.setViewAngleDegrees(sceneRenderer.LookAt[0]);
    camera.setPosition(
      sceneRenderer.LookAt[7], sceneRenderer.LookAt[8],
      sceneRenderer.LookAt[9]);
    camera.setFocalPoint(
      sceneRenderer.LookAt[1], sceneRenderer.LookAt[2],
      sceneRenderer.LookAt[3]);
    camera.setViewUpDirection(
      sceneRenderer.LookAt[4], sceneRenderer.LookAt[5],
      sceneRenderer.LookAt[6]);

    if (layer === 0) {
      bgc = sceneRenderer.Background1;
      renderer.setBackgroundColor(bgc[0], bgc[1], bgc[2], 1);
    } else {
      renderer.setResizable(false);
    }
    renderer.setLayer(layer);
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * initScene
   *
   * @returns viewer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.initScene = function () {
    var renderer, layer;

    if (m_vtkScene === null) {
      return m_viewer;
    }
    for (layer = m_vtkScene.Renderers.length - 1; layer >= 0; layer -= 1) {

      renderer = this.getRenderer(layer);
      this.parseSceneMetadata(renderer, layer);
    }

    return m_viewer;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * createViewer - Creates a viewer object.
   *
   * @param
   *
   * @returns viewer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.createViewer = function (node) {
    var interactorStyle;

    if (m_viewer === null) {
      m_node = node;
      m_viewer = vgl.viewer(node);
      m_viewer.init();
      m_viewer.renderWindow().removeRenderer(m_viewer.renderWindow().activeRenderer());
      m_viewer.renderWindow().addRenderer(new vgl.depthPeelRenderer());
      m_vtkRenderedList[0] = m_viewer.renderWindow().activeRenderer();
      m_viewer.renderWindow().resize(node.width, node.height);
      interactorStyle = vgl.pvwInteractorStyle();
      m_viewer.setInteractorStyle(interactorStyle);
    }

    return m_viewer;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * deleteViewer - Deletes the viewer object associated with the reader.
   *
   * @returns void
   */
  ////////////////////////////////////////////////////////////////////////////
  this.deleteViewer = function () {
    m_vtkRenderedList = {};
    m_viewer = null;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * updateCanvas -
   *
   * @param
   *
   * @returns void
   */
  ////////////////////////////////////////////////////////////////////////////
  this.updateCanvas = function (node) {
    m_node = node;
    m_viewer.renderWindow().resize(node.width, node.height);

    return m_viewer;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * clearVtkObjectData - Clear out the list of VTK geometry data.
   *
   * @param void
   * @returns void
   */
  ////////////////////////////////////////////////////////////////////////////
  this.numObjects = function () {
    return m_vtkObjectCount;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * getRenderer - Gets (or creates) the renderer for a layer.
   *
   * @param layer
   * @returns renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.getRenderer = function (layer) {
    var renderer;

    renderer = m_vtkRenderedList[layer];
    if (renderer === null || typeof renderer === 'undefined') {
      renderer = new vgl.renderer();
      renderer.setResetScene(false);
      renderer.setResetClippingRange(false);
      m_viewer.renderWindow().addRenderer(renderer);

      if (layer !== 0) {
        renderer.camera().setClearMask(vgl.GL.DepthBufferBit);
      }

      m_vtkRenderedList[layer] = renderer;
    }

    return renderer;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * setVtkScene - Set the VTK scene data for camera initialization.
   *
   * @param scene
   * @returns void
   */
  ////////////////////////////////////////////////////////////////////////////
  this.setVtkScene = function (scene) {
    m_vtkScene = scene;
  };

  return this;
};
