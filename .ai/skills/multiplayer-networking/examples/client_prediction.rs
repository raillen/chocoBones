use std::collections::VecDeque;

#[derive(Clone, Debug, PartialEq)]
pub struct PlayerState {
    pub position: (f32, f32),
    pub velocity: (f32, f32),
}

#[derive(Clone, Debug)]
pub struct InputCommand {
    pub sequence_number: u32,
    pub delta_time: f32,
    pub input_x: f32,
    pub input_y: f32,
}

pub struct ClientEntity {
    pub current_state: PlayerState,
    pub pending_inputs: VecDeque<InputCommand>,
    pub next_sequence_number: u32,
}

impl ClientEntity {
    pub fn new(initial_state: PlayerState) -> Self {
        Self {
            current_state: initial_state,
            pending_inputs: VecDeque::new(),
            next_sequence_number: 1,
        }
    }

    /// Predicts the next state based on input and stores it for later reconciliation
    pub fn apply_input_and_predict(&mut self, input_x: f32, input_y: f32, dt: f32) -> InputCommand {
        let command = InputCommand {
            sequence_number: self.next_sequence_number,
            delta_time: dt,
            input_x,
            input_y,
        };
        self.next_sequence_number += 1;

        // Apply prediction
        Self::step_physics(&mut self.current_state, &command);
        
        self.pending_inputs.push_back(command.clone());
        command
    }

    /// Called when the client receives an authoritative state from the server
    pub fn on_server_update(&mut self, server_state: &PlayerState, last_processed_sequence: u32) {
        // Remove acknowledged inputs
        self.pending_inputs.retain(|input| input.sequence_number > last_processed_sequence);

        // Overwrite local state with authoritative server state
        self.current_state = server_state.clone();

        // Re-apply all unacknowledged inputs
        for input in &self.pending_inputs {
            Self::step_physics(&mut self.current_state, input);
        }
    }

    fn step_physics(state: &mut PlayerState, input: &InputCommand) {
        let speed = 50.0;
        state.velocity.0 = input.input_x * speed;
        state.velocity.1 = input.input_y * speed;
        
        state.position.0 += state.velocity.0 * input.delta_time;
        state.position.1 += state.velocity.1 * input.delta_time;
    }
}
