use crate::types::{Box3D, GeometryDTO3D};

pub fn make_simple_3d() -> GeometryDTO3D {
    GeometryDTO3D {
        room_min: [0.0, 0.0, 0.0],
        room_max: [10.0, 10.0, 3.0],
        obstacles: vec![Box3D::new(4.0, 4.0, 0.0, 6.0, 6.0, 3.0)],
        start: [1.0, 1.0, 1.5],
        target: [9.0, 9.0, 1.5],
    }
}

pub fn make_corridor_3d() -> GeometryDTO3D {
    GeometryDTO3D {
        room_min: [0.0, 0.0, 0.0],
        room_max: [20.0, 6.0, 3.0],
        obstacles: vec![Box3D::new(10.0, 0.0, 0.0, 10.5, 6.0, 2.4)],
        start: [1.0, 3.0, 1.5],
        target: [19.0, 3.0, 1.5],
    }
}

pub fn make_multi_floor_3d() -> GeometryDTO3D {
    GeometryDTO3D {
        room_min: [0.0, 0.0, 0.0],
        room_max: [10.0, 10.0, 7.0],
        obstacles: vec![
            Box3D::new(0.0, 0.0, 3.0, 7.0, 10.0, 3.3),
            Box3D::new(7.0, 0.0, 3.0, 10.0, 7.0, 3.3),
        ],
        start: [1.0, 1.0, 1.5],
        target: [1.0, 1.0, 5.0],
    }
}

pub fn make_ceiling_beams_3d() -> GeometryDTO3D {
    let beams: Vec<Box3D> = [3.0, 6.0, 9.0, 12.0]
        .iter()
        .map(|&x| Box3D::new(x, 0.0, 2.4, x + 0.3, 15.0, 3.0))
        .collect();
    GeometryDTO3D {
        room_min: [0.0, 0.0, 0.0],
        room_max: [15.0, 15.0, 3.0],
        obstacles: beams,
        start: [1.0, 1.0, 2.0],
        target: [14.0, 14.0, 2.0],
    }
}

pub fn get_room(name: &str) -> Option<GeometryDTO3D> {
    match name {
        "simple" => Some(make_simple_3d()),
        "corridor" => Some(make_corridor_3d()),
        "multi_floor" => Some(make_multi_floor_3d()),
        "ceiling_beams" => Some(make_ceiling_beams_3d()),
        _ => None,
    }
}

pub fn room_names() -> Vec<&'static str> {
    vec!["simple", "corridor", "multi_floor", "ceiling_beams"]
}
