//////////////////////////////////////////////////////////////////////////////
/**
 * @module vgl
 */

/*global vgl, vec4, inherit*/
//////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a new instance of pvwInteractorStyle (for ParaViewWeb)
 *
 * @class vgl.pvwInteractorStyle
 * @returns {vgl.pvwInteractorStyle}
 */
//////////////////////////////////////////////////////////////////////////////
vgl.pvwInteractorStyle = function () {
  'use strict';

  if (!(this instanceof vgl.pvwInteractorStyle)) {
    return new vgl.pvwInteractorStyle();
  }
  vgl.trackballInteractorStyle.call(this);
  var m_that = this,
      m_leftMouseButtonDown = false,
      m_rightMouseButtonDown = false,
      m_middleMouseButtonDown = false,
      m_width,
      m_height,
      m_renderer,
      m_camera,
      m_outsideCanvas,
      m_coords,
      m_currentMousePos,
      m_focalPoint,
      m_focusWorldPt,
      m_focusDisplayPt,
      m_displayPt1,
      m_displayPt2,
      m_worldPt1,
      m_worldPt2,
      m_dx,
      m_dy,
      m_dz,
      m_zTrans,
      m_mouseLastPos = {
        x: 0,
        y: 0
      };

  function render() {
    m_renderer.resetCameraClippingRange();
    m_that.viewer().render();
  }

  /////////////////////////////////////////////////////////////////////////////
  /**
   * Handle mouse move event
   *
   * @param event
   * @returns {boolean}
   */
  /////////////////////////////////////////////////////////////////////////////
  this.handleMouseMove = function (event) {
    var rens = [], i = null, secCameras = [], deltaxy = null;
    m_width = m_that.viewer().renderWindow().windowSize()[0];
    m_height = m_that.viewer().renderWindow().windowSize()[1];
    m_renderer = m_that.viewer().renderWindow().activeRenderer();
    m_camera = m_renderer.camera();
    m_outsideCanvas = false;
    m_coords = m_that.viewer().relMouseCoords(event);
    m_currentMousePos = {
      x: 0,
      y: 0
    };

    // Get secondary cameras
    rens = m_that.viewer().renderWindow().renderers();
    for (i = 0; i < rens.length; i += 1) {
      if (m_renderer !== rens[i]) {
        secCameras.push(rens[i].camera());
      }
    }

    if ((m_coords.x < 0) || (m_coords.x > m_width)) {
      m_currentMousePos.x = 0;
      m_outsideCanvas = true;
    } else {
      m_currentMousePos.x = m_coords.x;
    }
    if ((m_coords.y < 0) || (m_coords.y > m_height)) {
      m_currentMousePos.y = 0;
      m_outsideCanvas = true;
    } else {
      m_currentMousePos.y = m_coords.y;
    }
    if (m_outsideCanvas === true) {
      return;
    }
    m_focalPoint = m_camera.focalPoint();
    m_focusWorldPt = vec4.fromValues(m_focalPoint[0], m_focalPoint[1],
                                     m_focalPoint[2], 1);
    m_focusDisplayPt = m_renderer.worldToDisplay(m_focusWorldPt,
        m_camera.viewMatrix(), m_camera.projectionMatrix(), m_width, m_height);
    m_displayPt1 = vec4.fromValues(
      m_currentMousePos.x, m_currentMousePos.y, m_focusDisplayPt[2], 1.0);
    m_displayPt2 = vec4.fromValues(
      m_mouseLastPos.x, m_mouseLastPos.y, m_focusDisplayPt[2], 1.0);
    m_worldPt1 = m_renderer.displayToWorld(
      m_displayPt1, m_camera.viewMatrix(), m_camera.projectionMatrix(),
      m_width, m_height);
    m_worldPt2 = m_renderer.displayToWorld(
      m_displayPt2, m_camera.viewMatrix(), m_camera.projectionMatrix(),
      m_width, m_height);

    m_dx = m_worldPt1[0] - m_worldPt2[0];
    m_dy = m_worldPt1[1] - m_worldPt2[1];
    m_dz = m_worldPt1[2] - m_worldPt2[2];

    if (m_middleMouseButtonDown) {
      m_camera.pan(-m_dx, -m_dy, -m_dz);
      render();
    }
    if (m_leftMouseButtonDown) {
      deltaxy = [(m_mouseLastPos.x - m_currentMousePos.x),
      (m_mouseLastPos.y - m_currentMousePos.y)];
      m_camera.rotate(deltaxy[0], deltaxy[1]);

      // Apply rotation to all other cameras
      for (i = 0; i < secCameras.length; i += 1) {
        secCameras[i].rotate(deltaxy[0], deltaxy[1]);
      }

      // Apply rotation to all other cameras
      for (i = 0; i < rens.length; i += 1) {
        rens[i].resetCameraClippingRange();
      }
      render();
    }
    if (m_rightMouseButtonDown) {
      /// 2.0 is the speed up factor.
      m_zTrans = 2.0 * (m_currentMousePos.y - m_mouseLastPos.y) / m_height;

      // Calculate zoom scale here
      if (m_zTrans > 0) {
        m_camera.zoom(1 - Math.abs(m_zTrans));
      } else {
        m_camera.zoom(1 + Math.abs(m_zTrans));
      }
      render();
    }
    m_mouseLastPos.x = m_currentMousePos.x;
    m_mouseLastPos.y = m_currentMousePos.y;
    return false;
  };

  /////////////////////////////////////////////////////////////////////////////
  /**
   * Handle mouse down event
   *
   * @param event
   * @returns {boolean}
   */
  /////////////////////////////////////////////////////////////////////////////
  this.handleMouseDown = function (event) {
    if (event.button === 0) {
      m_leftMouseButtonDown = true;
    }
    if (event.button === 1) {
      m_middleMouseButtonDown = true;
    }
    if (event.button === 2) {
      m_rightMouseButtonDown = true;
    }
    m_coords = m_that.viewer().relMouseCoords(event);
    if (m_coords.x < 0) {
      m_mouseLastPos.x = 0;
    } else {
      m_mouseLastPos.x = m_coords.x;
    }
    if (m_coords.y < 0) {
      m_mouseLastPos.y = 0;
    } else {
      m_mouseLastPos.y = m_coords.y;
    }
    return false;
  };

  // @note We never get mouse up from scroll bar: See the bug report here
  // http://bugs.jquery.com/ticket/8184
  /////////////////////////////////////////////////////////////////////////////
  /**
   * Handle mouse up event
   *
   * @param event
   * @returns {boolean}
   */
  /////////////////////////////////////////////////////////////////////////////
  this.handleMouseUp = function (event) {
    if (event.button === 0) {
      m_leftMouseButtonDown = false;
    }
    if (event.button === 1) {
      m_middleMouseButtonDown = false;
    }
    if (event.button === 2) {
      m_rightMouseButtonDown = false;
    }
    return false;
  };

  return this;
};
inherit(vgl.pvwInteractorStyle, vgl.trackballInteractorStyle);
