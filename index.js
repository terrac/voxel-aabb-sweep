'use strict'


// reused array instances

var tr_arr = []
var ldi_arr = []
var tri_arr = []
var step_arr = []
var tDelta_arr = []
var tNext_arr = []
var vec_arr = []
var normed_arr = []
var base_arr = []
var max_arr = []
var left_arr = []
var result_arr = []



// core implementation:

function sweep_impl(getVoxel, callback, vec, base, max, result) {

    // consider algo as a raycast along the AABB's leading corner
    // as raycast enters each new voxel, iterate in 2D over the AABB's 
    // leading face in that axis looking for collisions
    // 
    // original raycast implementation: https://github.com/andyhall/fast-voxel-raycast
    // original raycast paper: http://www.cse.chalmers.se/edu/year/2010/course/TDA361/grid.pdf

    var tr = tr_arr
    var ldi = ldi_arr
    var tri = tri_arr
    var step = step_arr
    var tDelta = tDelta_arr
    var tNext = tNext_arr
    var normed = normed_arr

    var floor = Math.floor
    var cumulative_t = 0.0
    var t = 0.0
    var max_t = 0.0
    var axis = 0
    var i = 0


    // init for the current sweep vector and take first step
    initSweep()
    if (max_t === 0) return 0

    axis = stepForward()

    // loop along raycast vector
    while (t <= max_t) {
        
        // sweeps over leading face of AABB
        if (checkCollision(axis)) {
            // calls the callback and decides whether to continue
            var done = handleCollision()
            if (done) return cumulative_t
        }

        axis = stepForward()
    }

    // reached the end of the vector unobstructed, finish and exit
    cumulative_t += max_t
    for (i = 0; i < 3; i++) result[i] += vec[i]
    return cumulative_t





    // low-level implementations of each step:

    function initSweep() {

        // parametrization t along raycast
        t = 0.0
        max_t = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2])
        if (max_t === 0) return

        var EPSILON = 1e-5

        for (var i = 0; i < 3; i++) {
            var dir = (vec[i] >= 0)
            step[i] = dir ? 1 : -1
            // trailing edge coord
            tr[i] = dir ? base[i] : max[i]
            // leading edge coord
            var lead = dir ? max[i] : base[i]
            // int values for edges, i.e. voxel coord of each edge 
            // sunken in a smidge to account for abutting a voxel edge
            ldi[i] = floor(lead - step[i] * EPSILON)
            tri[i] = floor(tr[i] + step[i] * EPSILON)
            // normed vector
            normed[i] = vec[i] / max_t
            // distance along t required to move one voxel in each axis
            tDelta[i] = Math.abs(1 / normed[i])
            // location of nearest voxel boundary, in units of t 
            var dist = dir ? (ldi[i] + 1 - lead) : (lead - ldi[i])
            tNext[i] = (tDelta[i] < Infinity) ? tDelta[i] * dist : Infinity
        }

        // console.log('===== sweep initted', t, max_t, 'vec: ', vec)

    }


    // check for collisions - iterate over the leading face on the advancing axis

    function checkCollision(i_axis) {
        var stepx = step[0]
        var x0 = (i_axis === 0) ? ldi[0] : tri[0]
        var x1 = ldi[0] + stepx

        var stepy = step[1]
        var y0 = (i_axis === 1) ? ldi[1] : tri[1]
        var y1 = ldi[1] + stepy

        var stepz = step[2]
        var z0 = (i_axis === 2) ? ldi[2] : tri[2]
        var z1 = ldi[2] + stepz

        var j_axis = (i_axis + 1) % 3
        var k_axis = (i_axis + 2) % 3
        var s = ['x', 'y', 'z'][i_axis]
        var js = ['x', 'y', 'z'][j_axis]
        var ks = ['x', 'y', 'z'][k_axis]
        var i0 = [x0, y0, z0][i_axis]
        var j0 = [x0, y0, z0][j_axis]
        var k0 = [x0, y0, z0][k_axis]
        var i1 = [x1 - stepx, y1 - stepy, z1 - stepz][i_axis]
        var j1 = [x1 - stepx, y1 - stepy, z1 - stepz][j_axis]
        var k1 = [x1 - stepx, y1 - stepy, z1 - stepz][k_axis]
        // console.log('=== step', s, 'to', i0, '   sweep', js, j0 + '-' + j1, '   ', ks, k0 + '-' + k1)

        for (var x = x0; x != x1; x += stepx) {
            for (var y = y0; y != y1; y += stepy) {
                for (var z = z0; z != z1; z += stepz) {
                    if (getVoxel(x, y, z)) return true
                }
            }
        }
        return false
    }


    // on collision - call the callback and return or set up for the next sweep

    function handleCollision() {

        // set up for callback
        cumulative_t += t
        var dir = step[axis]

        // vector moved so far, and left to move
        var done = t / max_t
        var left = left_arr
        for (i = 0; i < 3; i++) {
            var dv = vec[i] * done
            result[i] += dv
            base[i] += dv
            max[i] += dv
            left[i] = vec[i] - dv
        }

        // call back to let client update the "left to go" vector
        var res = callback(cumulative_t, axis, dir, left)

        // bail out out on truthy response
        if (res) return true

        // init for new sweep along vec
        for (i = 0; i < 3; i++) vec[i] = left[i]
        initSweep()
        if (max_t === 0) return true // no vector left

        return false
    }


    // advance to next voxel boundary, and return which axis was stepped

    function stepForward() {
        var axis = (tNext[0] < tNext[1]) ?
            ((tNext[0] < tNext[2]) ? 0 : 2) :
            ((tNext[1] < tNext[2]) ? 1 : 2)
        // console.log('==== stepping along: ', axis)
        var dt = tNext[axis] - t
        t = tNext[axis]
        ldi[axis] += step[axis]
        tNext[axis] += tDelta[axis]
        for (i = 0; i < 3; i++) {
            tr[i] += dt * normed[i]
            tri[i] = floor(tr[i])
        }
 
        return axis
    }

}





// conform inputs

function sweep(getVoxel, box, dir, callback, noTranslate) {

    var vec = vec_arr
    var base = base_arr
    var max = max_arr
    var result = result_arr

    // init parameter float arrays
    for (var i = 0; i < 3; i++) {
        vec[i] = +dir[i]
        max[i] = +box.max[i]
        base[i] = +box.base[i]
        result[i] = 0.0
    }

    // run sweep implementation
    var dist = sweep_impl(getVoxel, callback, vec, base, max, result)

    // translate box by distance needed to updated base value
    if (!noTranslate) box.translate(result)

    // return value is total distance moved (not necessarily magnitude of [end]-[start])
    return dist
}

module.exports = sweep

