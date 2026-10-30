function transformStringArrayToNormalArray(inputArr) {
    if (!Array.isArray(inputArr)) return undefined;
    if (inputArr.length === 0 || !inputArr[0].includes(',')) return inputArr;

    return inputArr.map((item) => item.split(',')).flat();
}