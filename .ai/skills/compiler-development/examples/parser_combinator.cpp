#include <iostream>
#include <string_view>
#include <optional>
#include <functional>

// Basic parser combinator example

template <typename T>
struct ParseResult {
    T value;
    std::string_view remaining;
};

template <typename T>
using Parser = std::function<std::optional<ParseResult<T>>(std::string_view)>;

// Parses a specific character
Parser<char> char_parser(char expected) {
    return [expected](std::string_view input) -> std::optional<ParseResult<char>> {
        if (!input.empty() && input.front() == expected) {
            return ParseResult<char>{expected, input.substr(1)};
        }
        return std::nullopt;
    };
}

// Combinator: Parses A then B
template <typename A, typename B>
Parser<std::pair<A, B>> sequence(Parser<A> parser_a, Parser<B> parser_b) {
    return [parser_a, parser_b](std::string_view input) -> std::optional<ParseResult<std::pair<A, B>>> {
        auto result_a = parser_a(input);
        if (!result_a) return std::nullopt;
        
        auto result_b = parser_b(result_a->remaining);
        if (!result_b) return std::nullopt;
        
        return ParseResult<std::pair<A, B>>{
            std::make_pair(result_a->value, result_b->value),
            result_b->remaining
        };
    };
}

int main() {
    auto parse_hello = sequence(char_parser('H'), char_parser('i'));
    
    auto result = parse_hello("HiThere");
    if (result) {
        std::cout << "Parsed: " << result->value.first << result->value.second 
                  << ", Remaining: " << result->remaining << "\n";
    } else {
        std::cout << "Parse failed.\n";
    }
    return 0;
}
