/// <reference types="vite/client" />

declare module "mep-routing-core" {
  export class MEPConfig {
    free(): void;
    name(): string;
    constructor(
      cross_section_mm: number,
      clearance_m: number,
      voxel_size_m: number,
      reward_target: number,
      reward_step: number,
      reward_collision: number,
      reward_turn_horizontal: number,
      reward_turn_vertical: number,
      reward_vertical_per_voxel: number,
      reward_revisit: number,
      max_steps: number,
      min_straight_before_bend: number
    );
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

  export function list_rooms(): string[];
  export function create_scene(room_name: string, mep: MEPConfig): number;
  export function create_scene_from_json(
    geometry_json: string,
    mep: MEPConfig
  ): number;
  export function get_scene_info(scene_id: number): any;
  export function get_voxels(scene_id: number): Uint8Array;
  export function get_obstacle_positions(scene_id: number): Float32Array;
  export function reset_episode(scene_id: number): number;
  export function step_episode(
    scene_id: number,
    state_id: number,
    action: number,
    mep: MEPConfig
  ): any;
  export function get_state_position(state_id: number): Uint32Array;
  export function get_obs(
    scene_id: number,
    state_id: number,
    mep: MEPConfig
  ): Float32Array;
  /** Observation width this build produces. */
  export function obs_dim(): number;
  /** Throws if the model was trained against a different observation width. */
  export function load_model(weights_json: string): number;
  export function predict_action(
    model_id: number,
    obs: Float32Array
  ): number;
  export function free_scene(scene_id: number): void;
  export function free_state(state_id: number): void;
  export function free_model(model_id: number): void;
  export function preset_duct(): MEPConfig;
  export function preset_pipe(): MEPConfig;
  export function preset_cable_tray(): MEPConfig;

  export default function init(): Promise<any>;
}
