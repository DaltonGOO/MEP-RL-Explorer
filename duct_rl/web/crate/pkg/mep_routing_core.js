/* @ts-self-types="./mep_routing_core.d.ts" */

export class Box3D {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Box3DFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_box3d_free(ptr, 0);
    }
    /**
     * @param {number} x_min
     * @param {number} y_min
     * @param {number} z_min
     * @param {number} x_max
     * @param {number} y_max
     * @param {number} z_max
     */
    constructor(x_min, y_min, z_min, x_max, y_max, z_max) {
        const ret = wasm.box3d_new(x_min, y_min, z_min, x_max, y_max, z_max);
        this.__wbg_ptr = ret >>> 0;
        Box3DFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get x_max() {
        const ret = wasm.__wbg_get_box3d_x_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x_min() {
        const ret = wasm.__wbg_get_box3d_x_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y_max() {
        const ret = wasm.__wbg_get_box3d_y_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y_min() {
        const ret = wasm.__wbg_get_box3d_y_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z_max() {
        const ret = wasm.__wbg_get_box3d_z_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z_min() {
        const ret = wasm.__wbg_get_box3d_z_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x_max(arg0) {
        wasm.__wbg_set_box3d_x_max(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x_min(arg0) {
        wasm.__wbg_set_box3d_x_min(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y_max(arg0) {
        wasm.__wbg_set_box3d_y_max(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y_min(arg0) {
        wasm.__wbg_set_box3d_y_min(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z_max(arg0) {
        wasm.__wbg_set_box3d_z_max(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z_min(arg0) {
        wasm.__wbg_set_box3d_z_min(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Box3D.prototype[Symbol.dispose] = Box3D.prototype.free;

export class MEPConfig {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(MEPConfig.prototype);
        obj.__wbg_ptr = ptr;
        MEPConfigFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MEPConfigFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_mepconfig_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get clearance_m() {
        const ret = wasm.__wbg_get_mepconfig_clearance_m(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get cross_section_mm() {
        const ret = wasm.__wbg_get_mepconfig_cross_section_mm(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get max_steps() {
        const ret = wasm.__wbg_get_mepconfig_max_steps(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get min_straight_before_bend() {
        const ret = wasm.__wbg_get_mepconfig_min_straight_before_bend(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get reward_collision() {
        const ret = wasm.__wbg_get_mepconfig_reward_collision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_revisit() {
        const ret = wasm.__wbg_get_mepconfig_reward_revisit(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_step() {
        const ret = wasm.__wbg_get_mepconfig_reward_step(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_target() {
        const ret = wasm.__wbg_get_mepconfig_reward_target(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_turn_horizontal() {
        const ret = wasm.__wbg_get_mepconfig_reward_turn_horizontal(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_turn_vertical() {
        const ret = wasm.__wbg_get_mepconfig_reward_turn_vertical(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get reward_vertical_per_voxel() {
        const ret = wasm.__wbg_get_mepconfig_reward_vertical_per_voxel(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get voxel_size_m() {
        const ret = wasm.__wbg_get_mepconfig_voxel_size_m(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.mepconfig_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} cross_section_mm
     * @param {number} clearance_m
     * @param {number} voxel_size_m
     * @param {number} reward_target
     * @param {number} reward_step
     * @param {number} reward_collision
     * @param {number} reward_turn_horizontal
     * @param {number} reward_turn_vertical
     * @param {number} reward_vertical_per_voxel
     * @param {number} reward_revisit
     * @param {number} max_steps
     * @param {number} min_straight_before_bend
     */
    constructor(cross_section_mm, clearance_m, voxel_size_m, reward_target, reward_step, reward_collision, reward_turn_horizontal, reward_turn_vertical, reward_vertical_per_voxel, reward_revisit, max_steps, min_straight_before_bend) {
        const ret = wasm.mepconfig_new(cross_section_mm, clearance_m, voxel_size_m, reward_target, reward_step, reward_collision, reward_turn_horizontal, reward_turn_vertical, reward_vertical_per_voxel, reward_revisit, max_steps, min_straight_before_bend);
        this.__wbg_ptr = ret >>> 0;
        MEPConfigFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} arg0
     */
    set clearance_m(arg0) {
        wasm.__wbg_set_mepconfig_clearance_m(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set cross_section_mm(arg0) {
        wasm.__wbg_set_mepconfig_cross_section_mm(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set max_steps(arg0) {
        wasm.__wbg_set_mepconfig_max_steps(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set min_straight_before_bend(arg0) {
        wasm.__wbg_set_mepconfig_min_straight_before_bend(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_collision(arg0) {
        wasm.__wbg_set_mepconfig_reward_collision(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_revisit(arg0) {
        wasm.__wbg_set_mepconfig_reward_revisit(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_step(arg0) {
        wasm.__wbg_set_mepconfig_reward_step(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_target(arg0) {
        wasm.__wbg_set_mepconfig_reward_target(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_turn_horizontal(arg0) {
        wasm.__wbg_set_mepconfig_reward_turn_horizontal(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_turn_vertical(arg0) {
        wasm.__wbg_set_mepconfig_reward_turn_vertical(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set reward_vertical_per_voxel(arg0) {
        wasm.__wbg_set_mepconfig_reward_vertical_per_voxel(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set voxel_size_m(arg0) {
        wasm.__wbg_set_mepconfig_voxel_size_m(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) MEPConfig.prototype[Symbol.dispose] = MEPConfig.prototype.free;

/**
 * Per-component reward breakdown for visualization.
 */
export class RewardBreakdown {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RewardBreakdownFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rewardbreakdown_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get collision_penalty() {
        const ret = wasm.__wbg_get_rewardbreakdown_collision_penalty(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get distance_delta() {
        const ret = wasm.__wbg_get_rewardbreakdown_distance_delta(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get revisit_penalty() {
        const ret = wasm.__wbg_get_rewardbreakdown_revisit_penalty(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get step_penalty() {
        const ret = wasm.__wbg_get_rewardbreakdown_step_penalty(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get target_bonus() {
        const ret = wasm.__wbg_get_rewardbreakdown_target_bonus(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get total() {
        const ret = wasm.__wbg_get_rewardbreakdown_total(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get turn_penalty() {
        const ret = wasm.__wbg_get_rewardbreakdown_turn_penalty(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get vertical_penalty() {
        const ret = wasm.__wbg_get_rewardbreakdown_vertical_penalty(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set collision_penalty(arg0) {
        wasm.__wbg_set_rewardbreakdown_collision_penalty(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set distance_delta(arg0) {
        wasm.__wbg_set_rewardbreakdown_distance_delta(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set revisit_penalty(arg0) {
        wasm.__wbg_set_rewardbreakdown_revisit_penalty(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set step_penalty(arg0) {
        wasm.__wbg_set_rewardbreakdown_step_penalty(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set target_bonus(arg0) {
        wasm.__wbg_set_rewardbreakdown_target_bonus(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total(arg0) {
        wasm.__wbg_set_rewardbreakdown_total(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set turn_penalty(arg0) {
        wasm.__wbg_set_rewardbreakdown_turn_penalty(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set vertical_penalty(arg0) {
        wasm.__wbg_set_rewardbreakdown_vertical_penalty(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) RewardBreakdown.prototype[Symbol.dispose] = RewardBreakdown.prototype.free;

/**
 * @param {string} room_name
 * @param {MEPConfig} mep
 * @returns {number}
 */
export function create_scene(room_name, mep) {
    const ptr0 = passStringToWasm0(room_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(mep, MEPConfig);
    const ret = wasm.create_scene(ptr0, len0, mep.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {string} geometry_json
 * @param {MEPConfig} mep
 * @returns {number}
 */
export function create_scene_from_json(geometry_json, mep) {
    const ptr0 = passStringToWasm0(geometry_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(mep, MEPConfig);
    const ret = wasm.create_scene_from_json(ptr0, len0, mep.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {number} model_id
 */
export function free_model(model_id) {
    wasm.free_model(model_id);
}

/**
 * @param {number} scene_id
 */
export function free_scene(scene_id) {
    wasm.free_scene(scene_id);
}

/**
 * @param {number} state_id
 */
export function free_state(state_id) {
    wasm.free_state(state_id);
}

/**
 * @param {number} scene_id
 * @param {number} state_id
 * @returns {Float32Array}
 */
export function get_obs(scene_id, state_id) {
    const ret = wasm.get_obs(scene_id, state_id);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {number} scene_id
 * @returns {Float32Array}
 */
export function get_obstacle_positions(scene_id) {
    const ret = wasm.get_obstacle_positions(scene_id);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {number} scene_id
 * @returns {any}
 */
export function get_scene_info(scene_id) {
    const ret = wasm.get_scene_info(scene_id);
    return ret;
}

/**
 * @param {number} state_id
 * @returns {Uint32Array}
 */
export function get_state_position(state_id) {
    const ret = wasm.get_state_position(state_id);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {number} scene_id
 * @returns {Uint8Array}
 */
export function get_voxels(scene_id) {
    const ret = wasm.get_voxels(scene_id);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @returns {any}
 */
export function list_rooms() {
    const ret = wasm.list_rooms();
    return ret;
}

/**
 * @param {string} weights_json
 * @returns {number}
 */
export function load_model(weights_json) {
    const ptr0 = passStringToWasm0(weights_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.load_model(ptr0, len0);
    return ret >>> 0;
}

/**
 * @param {number} model_id
 * @param {Float32Array} obs
 * @returns {number}
 */
export function predict_action(model_id, obs) {
    const ptr0 = passArrayF32ToWasm0(obs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.predict_action(model_id, ptr0, len0);
    return ret;
}

/**
 * @returns {MEPConfig}
 */
export function preset_cable_tray() {
    const ret = wasm.preset_cable_tray();
    return MEPConfig.__wrap(ret);
}

/**
 * @returns {MEPConfig}
 */
export function preset_duct() {
    const ret = wasm.preset_duct();
    return MEPConfig.__wrap(ret);
}

/**
 * @returns {MEPConfig}
 */
export function preset_pipe() {
    const ret = wasm.preset_pipe();
    return MEPConfig.__wrap(ret);
}

/**
 * @param {number} scene_id
 * @returns {number}
 */
export function reset_episode(scene_id) {
    const ret = wasm.reset_episode(scene_id);
    return ret >>> 0;
}

/**
 * @param {number} scene_id
 * @param {number} state_id
 * @param {number} action
 * @param {MEPConfig} mep
 * @returns {any}
 */
export function step_episode(scene_id, state_id, action, mep) {
    _assertClass(mep, MEPConfig);
    const ret = wasm.step_episode(scene_id, state_id, action, mep.__wbg_ptr);
    return ret;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_83742b46f01ce22d: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_debug_string_5398f5bb970e0daa: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_string_7ef6b97b02428fae: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_49d5571bd3f0c4d4: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_a70fbab9066b301f: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_ab79df5bd7c26067: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_set_282384002438957f: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_bf7251625df30a02: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mep_routing_core_bg.js": import0,
    };
}

const Box3DFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_box3d_free(ptr >>> 0, 1));
const MEPConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_mepconfig_free(ptr >>> 0, 1));
const RewardBreakdownFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rewardbreakdown_free(ptr >>> 0, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('mep_routing_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
