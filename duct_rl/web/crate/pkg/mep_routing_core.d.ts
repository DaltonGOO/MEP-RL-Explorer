/* tslint:disable */
/* eslint-disable */

export class Box3D {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x_min: number, y_min: number, z_min: number, x_max: number, y_max: number, z_max: number);
    x_max: number;
    x_min: number;
    y_max: number;
    y_min: number;
    z_max: number;
    z_min: number;
}

export class MEPConfig {
    free(): void;
    [Symbol.dispose](): void;
    name(): string;
    constructor(cross_section_mm: number, clearance_m: number, voxel_size_m: number, reward_target: number, reward_step: number, reward_collision: number, reward_turn_horizontal: number, reward_turn_vertical: number, reward_vertical_per_voxel: number, reward_revisit: number, max_steps: number, min_straight_before_bend: number);
    clearance_m: number;
    cross_section_mm: number;
    max_steps: number;
    min_straight_before_bend: number;
    reward_collision: number;
    reward_revisit: number;
    reward_step: number;
    reward_target: number;
    reward_turn_horizontal: number;
    reward_turn_vertical: number;
    reward_vertical_per_voxel: number;
    voxel_size_m: number;
}

/**
 * Per-component reward breakdown for visualization.
 */
export class RewardBreakdown {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    collision_penalty: number;
    distance_delta: number;
    revisit_penalty: number;
    step_penalty: number;
    target_bonus: number;
    total: number;
    turn_penalty: number;
    vertical_penalty: number;
}

export function create_scene(room_name: string, mep: MEPConfig): number;

export function create_scene_from_json(geometry_json: string, mep: MEPConfig): number;

export function free_model(model_id: number): void;

export function free_scene(scene_id: number): void;

export function free_state(state_id: number): void;

export function get_obs(scene_id: number, state_id: number, mep: MEPConfig): Float32Array;

export function get_obstacle_positions(scene_id: number): Float32Array;

export function get_scene_info(scene_id: number): any;

export function get_state_position(state_id: number): Uint32Array;

export function get_voxels(scene_id: number): Uint8Array;

export function list_rooms(): any;

export function load_model(weights_json: string): number;

/**
 * Observation width this build produces. Exposed so the frontend can tell a
 * stale model from a current one before loading it.
 */
export function obs_dim(): number;

export function predict_action(model_id: number, obs: Float32Array): number;

export function preset_cable_tray(): MEPConfig;

export function preset_duct(): MEPConfig;

export function preset_pipe(): MEPConfig;

export function reset_episode(scene_id: number): number;

export function step_episode(scene_id: number, state_id: number, action: number, mep: MEPConfig): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_box3d_free: (a: number, b: number) => void;
    readonly __wbg_get_box3d_x_max: (a: number) => number;
    readonly __wbg_get_box3d_x_min: (a: number) => number;
    readonly __wbg_get_box3d_y_max: (a: number) => number;
    readonly __wbg_get_box3d_y_min: (a: number) => number;
    readonly __wbg_get_box3d_z_max: (a: number) => number;
    readonly __wbg_get_box3d_z_min: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_target_bonus: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_total: (a: number) => number;
    readonly __wbg_rewardbreakdown_free: (a: number, b: number) => void;
    readonly __wbg_set_box3d_x_max: (a: number, b: number) => void;
    readonly __wbg_set_box3d_x_min: (a: number, b: number) => void;
    readonly __wbg_set_box3d_y_max: (a: number, b: number) => void;
    readonly __wbg_set_box3d_y_min: (a: number, b: number) => void;
    readonly __wbg_set_box3d_z_max: (a: number, b: number) => void;
    readonly __wbg_set_box3d_z_min: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_target_bonus: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_total: (a: number, b: number) => void;
    readonly box3d_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly __wbg_set_rewardbreakdown_collision_penalty: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_distance_delta: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_revisit_penalty: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_step_penalty: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_turn_penalty: (a: number, b: number) => void;
    readonly __wbg_set_rewardbreakdown_vertical_penalty: (a: number, b: number) => void;
    readonly __wbg_get_rewardbreakdown_collision_penalty: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_distance_delta: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_revisit_penalty: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_step_penalty: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_turn_penalty: (a: number) => number;
    readonly __wbg_get_rewardbreakdown_vertical_penalty: (a: number) => number;
    readonly __wbg_get_mepconfig_clearance_m: (a: number) => number;
    readonly __wbg_get_mepconfig_cross_section_mm: (a: number) => number;
    readonly __wbg_get_mepconfig_max_steps: (a: number) => number;
    readonly __wbg_get_mepconfig_min_straight_before_bend: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_collision: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_revisit: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_step: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_target: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_turn_horizontal: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_turn_vertical: (a: number) => number;
    readonly __wbg_get_mepconfig_reward_vertical_per_voxel: (a: number) => number;
    readonly __wbg_get_mepconfig_voxel_size_m: (a: number) => number;
    readonly __wbg_mepconfig_free: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_clearance_m: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_cross_section_mm: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_max_steps: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_min_straight_before_bend: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_collision: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_revisit: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_step: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_target: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_turn_horizontal: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_turn_vertical: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_reward_vertical_per_voxel: (a: number, b: number) => void;
    readonly __wbg_set_mepconfig_voxel_size_m: (a: number, b: number) => void;
    readonly create_scene: (a: number, b: number, c: number) => number;
    readonly create_scene_from_json: (a: number, b: number, c: number) => number;
    readonly free_model: (a: number) => void;
    readonly free_scene: (a: number) => void;
    readonly free_state: (a: number) => void;
    readonly get_obs: (a: number, b: number, c: number) => [number, number];
    readonly get_obstacle_positions: (a: number) => [number, number];
    readonly get_scene_info: (a: number) => any;
    readonly get_state_position: (a: number) => [number, number];
    readonly get_voxels: (a: number) => [number, number];
    readonly list_rooms: () => any;
    readonly load_model: (a: number, b: number) => number;
    readonly mepconfig_name: (a: number) => [number, number];
    readonly mepconfig_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly obs_dim: () => number;
    readonly predict_action: (a: number, b: number, c: number) => number;
    readonly preset_cable_tray: () => number;
    readonly preset_duct: () => number;
    readonly preset_pipe: () => number;
    readonly reset_episode: (a: number) => number;
    readonly step_episode: (a: number, b: number, c: number, d: number) => any;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
