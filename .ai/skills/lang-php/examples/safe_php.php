<?php
declare(strict_types=1);

function calculateDiscount(float $price, float $rate): float {
    return $price * (1.0 - $rate);
}
