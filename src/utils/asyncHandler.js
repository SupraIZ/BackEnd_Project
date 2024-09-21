//the basic need of this file is to minimize the usage of try-catch block in controllers.

// promise handler way
const asyncHandler = (requestHandler) => {
  // Higher Order function =>  Here, as accepted as a function and also returned as a function also.
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch
    ((err) => next(err));
  };
};

export { asyncHandler };

// #ANOTHER WAY TO WRITE THE FUNCTION try-catch way
// const asyncHandler = (fn) => async(req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message,
//         })
//     }
// }
