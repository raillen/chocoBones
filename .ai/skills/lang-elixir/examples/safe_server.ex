defmodule SafeServer do
  use GenServer
  def start_link(init_arg), do: GenServer.start_link(__MODULE__, init_arg)
  @impl true
  def init(state), do: {:ok, state}
end
