# frozen_string_literal: true

class PaymentProcessor
  def process(amount)
    raise ArgumentError, "Invalid amount" if amount <= 0
    true
  end
end
