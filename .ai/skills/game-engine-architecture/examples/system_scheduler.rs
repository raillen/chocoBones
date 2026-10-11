use std::any::{Any, TypeId};
use std::collections::HashMap;

// A simple example of system scheduling concept in an ECS

pub struct World {
    resources: HashMap<TypeId, Box<dyn Any>>,
}

impl World {
    pub fn new() -> Self {
        Self {
            resources: HashMap::new(),
        }
    }

    pub fn insert_resource<T: 'static>(&mut self, resource: T) {
        self.resources.insert(TypeId::of::<T>(), Box::new(resource));
    }

    pub fn get_resource<T: 'static>(&self) -> Option<&T> {
        self.resources
            .get(&TypeId::of::<T>())
            .and_then(|boxed| boxed.downcast_ref::<T>())
    }
    
    pub fn get_resource_mut<T: 'static>(&mut self) -> Option<&mut T> {
        self.resources
            .get_mut(&TypeId::of::<T>())
            .and_then(|boxed| boxed.downcast_mut::<T>())
    }
}

pub trait System {
    fn run(&self, world: &mut World);
}

// Example Resources
struct Time { delta_time: f32 }
struct PlayerScore { points: u32 }

// Example System
struct UpdateScoreSystem;
impl System for UpdateScoreSystem {
    fn run(&self, world: &mut World) {
        let dt = world.get_resource::<Time>().map(|t| t.delta_time).unwrap_or(0.0);
        if let Some(score) = world.get_resource_mut::<PlayerScore>() {
            score.points += (dt * 10.0) as u32;
            println!("Score updated! New points: {}", score.points);
        }
    }
}

pub struct Schedule {
    systems: Vec<Box<dyn System>>,
}

impl Schedule {
    pub fn new() -> Self {
        Self { systems: Vec::new() }
    }

    pub fn add_system<S: System + 'static>(&mut self, system: S) {
        self.systems.push(Box::new(system));
    }

    pub fn run_all(&self, world: &mut World) {
        // In a real engine, we would analyze dependencies and run systems in parallel
        for system in &self.systems {
            system.run(world);
        }
    }
}

fn main() {
    let mut world = World::new();
    world.insert_resource(Time { delta_time: 0.16 }); // ~60fps
    world.insert_resource(PlayerScore { points: 0 });

    let mut schedule = Schedule::new();
    schedule.add_system(UpdateScoreSystem);

    println!("Running frame 1...");
    schedule.run_all(&mut world);
    
    println!("Running frame 2...");
    schedule.run_all(&mut world);
}
