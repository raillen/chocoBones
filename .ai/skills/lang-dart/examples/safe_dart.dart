Future<int> processData(List<int> numbers) async {
  return numbers.fold(0, (prev, elem) => prev + elem);
}
